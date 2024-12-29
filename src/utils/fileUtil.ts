import * as fs from 'fs';
import * as path from 'path';

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