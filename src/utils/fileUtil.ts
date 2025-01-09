import * as fs from 'fs';
import * as path from 'path';
import * as libre from 'libreoffice-convert';
import AdmZip from 'adm-zip';
import { removeBackground } from "@imgly/background-removal-node";

//Hàm đọc file:
export async function readFile(filePath: string): Promise<Buffer> {
    try {
        const absolutePath = path.resolve(filePath);
        const data = await fs.promises.readFile(absolutePath);
        return data;
    } catch (err) {
        console.error(`Error reading file at ${filePath}: ${err}`);
        return Promise.reject(err);
    }
}

//Chuyển file docx hoặc docx buffer sang dạng pdf buffer:
export const convertDocxToPdfBuffer = async (pathOrBuffer: { path?: string; buffer?: Buffer }): Promise<Buffer> => {
    try {
        const dataBuffer = pathOrBuffer.path ? await readFile(pathOrBuffer.path) : pathOrBuffer.buffer;
        if (!dataBuffer) return Promise.reject(new Error('File not found'));

        return new Promise((resolve, reject) => {
            libre.convert(dataBuffer, '.pdf', '', (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    } catch (err) {
        console.error('Error reading file:', err);
        return Promise.reject(err);
    }
};

//Xem có phải là docx không:
export function isDocx(buffer: Buffer): boolean {
    try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries().map(entry => entry.entryName);
        return entries.includes('[Content_Types].xml') && entries.some(name => name.startsWith('word/'));
    } catch (error) {
        console.error('Error while checking DOCX file:', error);
        return false;
    }
}

//Hàm check loại tài liệu:
export function detectFileType(base64: string): string {
    const binary = Buffer.from(base64, 'base64');
    const signature = binary.toString('hex', 0, 4).toUpperCase();
    if (signature === '25504446') {
        return 'PDF';
    } else if (signature === '504B0304') {
        if (isDocx(binary)) {
            return 'DOCX';
        }
        return 'ZIP';
    }
    return 'UNKNOWN';
}

//Hàm check loại file ảnh:
export function identifyFileByContent(buffer: Buffer): string {
    const content = buffer.toString('ascii', 0, 20);
    if (content.includes('PNG')) return 'PNG';
    if (content.includes('JFIF') || content.includes('Exif')) return 'JPG';
    return 'UNKNOWN';
}

//Hàm xóa nền ảnh:
export async function removeBackgroundFromBuffer(inputBuffer: Buffer, imgType: string): Promise<Buffer> {
    try {
        const blodType = imgType == "PNG" ? "image/png" : "image/jpeg";
        const blobInput = new Blob([inputBuffer], { type: blodType });
        const resultBlob = await removeBackground(blobInput);
        const arrayBuffer = await resultBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log('====================================');
        console.log('Xóa nền thành công!');
        console.log('====================================');
        return buffer;
    } catch (error) {
        console.error('Lỗi khi xóa nền:', error);
        return inputBuffer;
    }
}


