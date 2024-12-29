# Signature Demo

This project is a demo application for uploading and signing documents.

## Prerequisites

- Node.js 18.x
- npm

## Getting Started

### Clone the repository

```sh
git clone <repository-url>
cd <repository-name>
```

### Install dependencies

```sh
npm install
```

### Configuration
Create a .env file in the root directory and add the following content like .env-example

### Build the project

```sh
npm run build
```

### Start the project
```sh
npm run dev
npm run dev (with nodemon)
```



## API Endpoints

#### Upload and Sign Document View
```http
  GET /api/add-sign/form
  Content-Type: multipart/form-data
```

#### Upload and Sign Document (Form)

```http
  POST /api/add-sign/form
  Content-Type: multipart/form-data
```

| Parameter | Type     | Description                    |
| :-------- | :------- | :------------------------------|
| `file`    | `file`   | **Required**. DOCX or PDF file |
| `signatureImage` | `file` | **Required**. PNG or JPG image|
| `signName` | `string` | **Required**. Name of the signer|
| `signType` | `number` | **Required**. Type of signature (1 for main, 0 for secondary)|

#### Upload and Sign Document (JSON)

```http
  POST /api/add-sign/json
```

| Parameter | Type     | Description                    |
| :-------- | :------- | :------------------------------|
| `pdfBase64` | `string` | **Required**. Base64 PDF data |
| `signImgBase64` | `string` | **Required**. Base64 signature image |
| `signName` | `string` | **Required**. Name of the signer|
| `signType` | `number` | **Required**. Type of signature (1 for main, 0 for secondary)|

#### Convert PDF or Image to Base64

```http
  POST /api/to-base64
  Content-Type: multipart/form-data
```

| Parameter | Type     | Description                    |
| :-------- | :------- | :------------------------------|
| `file`    | `file`   | **Required**. PDF or IMG file |