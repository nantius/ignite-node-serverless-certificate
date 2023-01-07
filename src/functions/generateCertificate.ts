import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from "../utils/dynamodbClient";
import  {compile} from "handlebars";
import dayjs from "dayjs";
import { readFileSync } from "fs";
import { join } from "path";
import chromium from "chrome-aws-lambda";
import { S3 } from "aws-sdk"

interface ICreateCertificate {
    id: string;
    name: string;
    grade: string;
}

interface ITemplate extends ICreateCertificate {
    medal: string;
    date: string;
}


const compileTemplate = async (data: ITemplate) => {
    const filePath = join(process.cwd(), "src", "templates", "certificate.hbs");
    const html = readFileSync(filePath, "utf-8");
    return compile(html)(data);
}


export const handler: APIGatewayProxyHandler = async (event) => {
    const data = JSON.parse(event.body) as ICreateCertificate;

    const response = await document.query({
        TableName: "users_certificate",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": data.id
        }
    }).promise();

    const userAlreadyExists = response.Items[0];

    if(!userAlreadyExists) {
        await document.put({
            TableName: "users_certificate",
            Item: {
                ...data,
                created_at: new Date().toISOString()
            }
        }).promise();
    }

    const medalPath = join(process.cwd(), "src", "templates", "selo.png");
    const medal = readFileSync(medalPath, "base64");

    const templateData: ITemplate = {
        ...data,
        date: dayjs().format("DD/MM/YYYY"),
        medal
    };

    const content = await compileTemplate(templateData);

    const browser = await chromium.puppeteer.launch({
        headless: true,
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
    });

    const page = await browser.newPage();

    await page.setContent(content);
    const pdf = await page.pdf({
        format: "a4",
        landscape: true,
        path: process.env.IS_OFFLINE ? "certificate.pdf" : null,
        printBackground: true,
        preferCSSPageSize: true
    });

    if(!process.env.IS_OFFLINE) {
        const s3 = new S3();

        await s3.putObject({
            Bucket: "bucket-name-example",
            Key: `${data.id}.pdf`,
            ACL: "public-read",
            Body: pdf,
            ContentType: "application/pdf"
        }).promise();
    }
   

    await browser.close();

    return {
        statusCode: 201,
        body: JSON.stringify({
            message: "Certificate created!",
            response: response.Items[0]
        })
    }

}