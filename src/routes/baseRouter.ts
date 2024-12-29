import { Router, Request, Response } from 'express';
import multer from 'multer';

import { 
    handleAddSignImgToPdfAsJson, 
    handleAddSignImgToPdfWithForm, 
    viewAddSignImgToPdf, 
    handleConvertPdfOrImgToPdfBase64
} from '../controllers/Signature';

const baseRouter = Router();

const upload = multer({
    dest: 'dist/public/uploads/',
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận tệp PDF, DOCX, PNG, JPG!'));
        }
    },
    limits: { fileSize: 4 * 1024 * 1024 },
});

const uploadFields = upload.fields([
    { name: 'file', maxCount: 1 }, 
    { name: 'signatureImage', maxCount: 1 }, 
]);

baseRouter.get('/', (req: Request, res: Response) => {
    res.send('Hello World');
});

baseRouter.get('/add-sign/form', viewAddSignImgToPdf);

baseRouter.post('/add-sign/form', uploadFields, handleAddSignImgToPdfWithForm);

baseRouter.post('/add-sign/json', handleAddSignImgToPdfAsJson);

baseRouter.post('/to-base64', uploadFields, handleConvertPdfOrImgToPdfBase64);

export default baseRouter;
