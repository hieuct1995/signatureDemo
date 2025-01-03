import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import * as libre from 'libreoffice-convert';
import { readFile } from '../utils/fileUtil';

const rootPath = process.env.ROOT_PATH || "";

interface signPosition {
    x: number;
    y: number;
    pageNum: number;
}

//Hàm check loại file ảnh:
function identifyFileByContent(buffer: Buffer): string {
    const content = buffer.toString('ascii', 0, 20);
    if (content.includes('PNG')) return 'PNG';
    if (content.includes('JFIF') || content.includes('Exif')) return 'JPG';
    return 'Unknown';
}


//Chuyển file docx sang dạng pdf buffer:
export const convertDocxToPdfBuffer = async (pathOfDocFile: string): Promise<Buffer> => {
    try {
        const dataBuffer = await readFile(pathOfDocFile);
        return new Promise((resolve, reject) => {
            libre.convert(dataBuffer, '.pdf', '', (err, result) => {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(result);
                }
            });
        });
    } catch (err) {
        console.error('Error reading file:', err);
        return Promise.reject(err);
    }
};


// Import lib pdfjs-dist và trả về đối tượng chứa thông tin file:
export const getTextFromPDF = async ( pdfBuffer: Buffer) => {

    const pdfjsLib = await import('pdfjs-dist');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer }); //tải tài liệu
    const pdf = await loadingTask.promise;
    return pdf;
};


// Hàm thêm ảnh vào file pdf:
export async function addSignImgToPdf(pdfBuffer: Buffer, signImgBuffer: Buffer, signName: string, signType: number) {
    try {
        const pdf = await getTextFromPDF(pdfBuffer);

        let signPosition: signPosition = { x: 0, y: 0, pageNum: 0 };
        let endBody = false;
        let hasSignName = false;
        let signNameWidth = 0;
        let signNameHeight = 0;
        const isMainSign = signType == 1;
        
        let currentText = ''; // Lưu trữ tạm thời các phần tên đang được ghép
        let startX: number = 0; 
        let startY: number = 0;
        let signTempWidth = 0; //Độ rộng tạm thời của phần tên

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent(); // trả về đối tượng chứa các items và styles
            textContent.items.forEach((item: Record<string, any>,) => {
                const text: string = item.str;

                if (text == './.') {
                    endBody = true;
                }
                const transform: number[] = item.transform;
                if (endBody) {
                    if (text == signName) {
                        // Trường hợp khớp hoàn toàn
                        const x = transform[4];
                        const y = transform[5];
                        signNameWidth = item.width;
                        signNameHeight = item.height;
                        hasSignName = true;
                        signPosition = { x, y, pageNum };

                    } else if (signName.startsWith(currentText + text)) {
                        // Trường hợp chưa khớp hoàn toàn
                        if (!currentText) {
                            startX = transform[4];
                            startY = transform[5];
                        }
                        currentText += text;
                        signTempWidth += item.width;

                        // Nếu ghép đủ và khớp hoàn toàn với signName
                        if (currentText === signName) {
                            signNameWidth = signTempWidth;
                            signNameHeight = item.height;
                            hasSignName = true;

                            signPosition = {
                                x: startX,
                                y: startY,
                                pageNum,
                            };

                            currentText = '';
                            startX = 0;
                            startY = 0;
                        }
                    } else {
                        if (currentText) {
                            console.log(`Chuỗi ghép dở bị gián đoạn: ${currentText} + ${text}`);
                        }
                        currentText = '';
                        startX = 0;
                        startY = 0;
                    }
                }
            });

            if (hasSignName) break;
        }

        if (!endBody) {
            return {
                success: false,
                message: 'Không tìm thấy dấu kết thúc ./. trong file.',
                data: pdfBuffer
            };
        }
        if (!hasSignName) {
            return {
                success: false,
                message: 'Không tìm thấy tên người ký trong file.',
                data: pdfBuffer
            };
        }

        const pdfDoc = await PDFDocument.load(pdfBuffer); // đối tượng PDFDocument

        const typeImg = identifyFileByContent(signImgBuffer);

        const signatureImage = typeImg == 'PNG' ? await pdfDoc.embedPng(signImgBuffer) : await pdfDoc.embedJpg(signImgBuffer) 

        const { x, y, pageNum } = signPosition;
        //pdf-lib đánh số trang từ 0:
        const page = pdfDoc.getPage(pageNum - 1);

        const signatureWidth = 120;
        const signatureHeight = 50;

        //Nếu là ký chính, chèn ảnh lên trên tên người ký:
        if (isMainSign) {
            const moveUpFromSignName = signNameHeight + 10;
            const moveX = (signatureWidth - signNameWidth) / 2;
    
            page.drawImage(signatureImage, {
                x: x - moveX,
                y: y + moveUpFromSignName,
                width: signatureWidth,
                height: signatureHeight,
            });
        } else {
            //Nếu là ký nháy chèn ảnh ký sang phải tên người ký:
            const moveUpFromSignName = signNameWidth + 10;
            const moveY = (signatureHeight - signNameHeight) / 2;
            page.drawImage(signatureImage, {
                x: x + moveUpFromSignName,
                y: y - moveY,
                width: signatureWidth,
                height: signatureHeight,
            });
        }

        // Lưu PDF mới với ảnh chữ ký
        const pdfWithSign = await pdfDoc.save();
        return {
            success: true,
            message: 'Thêm ảnh ký thành công!',
            data: pdfWithSign
        }

    } catch (err) {
        console.error('Error add img to file:', err);
        return {
            success: false,
            message: 'Error add img to file.',
            data: pdfBuffer
        };
    }
}

// Hàm thêm ảnh vào file pdf cho API trả về JSON:
export const handleAddSignImgToPdfAsJson = async (req: Request, res: Response) => {

    const {pdfBase64, signImgBase64, signName, signType } = req.body;
    try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const signImgBuffer = Buffer.from(signImgBase64, 'base64');
        const pdfDataAfterAddSign = await addSignImgToPdf(pdfBuffer, signImgBuffer, signName, signType);
        const { success, message, data } = pdfDataAfterAddSign;
        if (success) {
            const dataBase64 = Buffer.from(data).toString('base64');
            fs.writeFileSync(`${rootPath}/dist/public/${signName}_signed.pdf`, data);
            res.status(200).json({
                success,
                message,
                data: dataBase64
            });
            return;
        }
        res.json({
            success,
            message,
            data: pdfBase64
        });
    } catch (error) {
        console.error('Có lỗi xảy ra:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ta',
            data: pdfBase64
        });
    }
};

//Thêm ảnh vào file pdf cho API với form nhập liệu:
export const handleAddSignImgToPdfWithForm = async (req: Request, res: Response) => {
    try {

        const signName = req.body?.signName as string;
        const signType = req.body?.signType as number;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const docFile = files.file[0];
        const signImage = files.signatureImage[0];

        const nameOfDocFile = docFile.originalname || "";
        const pathOfDocFile = docFile.path || "";
        const nameOfSignatureImage = signImage.originalname || "";
        const pathOfSignatureImage = signImage.path || "";

        let isDocxFile = true;
        if (nameOfDocFile.toLowerCase().endsWith('.pdf')) {
            isDocxFile = false;
        }

        const signatureImageBuffer = await readFile(pathOfSignatureImage);
        const pdfBuffer = isDocxFile ? await convertDocxToPdfBuffer(pathOfDocFile) : await readFile(pathOfDocFile);

        //Thêm ảnh vào file PDF:
        const pdfDataAfterAddSign = await addSignImgToPdf(pdfBuffer, signatureImageBuffer, signName, signType);

        //Thêm ảnh xong xóa file tạm:
        fs.unlinkSync(pathOfDocFile);
        fs.unlinkSync(pathOfSignatureImage);

        if (!pdfDataAfterAddSign.success) {
            res.status(400).send(pdfDataAfterAddSign.message);
            return;
        }
        const pdfBytes = pdfDataAfterAddSign.data;

        const namePdfSigned = isDocxFile ? nameOfDocFile.replace('.docx', '-signed.pdf') : nameOfDocFile.replace('.pdf', '-signed.pdf');
        const outputPdfPath = path.join(rootPath, `dist/public/${namePdfSigned}`);

        fs.writeFileSync(outputPdfPath, pdfBytes);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${namePdfSigned}`);
        return res.sendFile(outputPdfPath);
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).send('Đã xảy ra lỗi khi xử lý file.');
    }
};

//View giao diện thêm chữ ký vào file:
export const viewAddSignImgToPdf = (req: Request, res: Response) => {
    try {
        res.sendFile(path.join(__dirname, '../views', 'index.html'));
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};


//Chuyển file pdf hoặc ảnh sang dạng pdf base64:
export const convertPdfOrImgToPdfBase64 = async (pathOfPdfFile: string): Promise<string> => {
    try {
        const dataBuffer = await readFile(pathOfPdfFile);
        const dataBase64 = Buffer.from(dataBuffer).toString('base64');
        return dataBase64;
    } catch (err) {
        console.error('Error reading file:', err);
        return Promise.reject(err);
    }
};

//Chuyển file pdf hoặc ảnh sang dạng pdf base64 API:
export const handleConvertPdfOrImgToPdfBase64 = async (req: Request, res: Response) => {
    try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const file = files.file[0];
        const pathOfPdfFile = file.path || "";
        const pdfBase64 = await convertPdfOrImgToPdfBase64(pathOfPdfFile);
        fs.unlinkSync(pathOfPdfFile);
        res.status(200).json({ 
            success: true, 
            message: 'Thành công!',
            data: pdfBase64 
        });
    } catch (error) {
        console.error('Có lỗi xảy ra:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ta',
            data: null
        });
    }
}