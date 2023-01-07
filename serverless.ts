import type { AWS } from '@serverless/typescript';

// serverless config credentials --provider aws --key=example --secret=example
const serverlessConfiguration: AWS = {
  service: 'certificateignite',
  frameworkVersion: '3',
  plugins: ['serverless-esbuild', "serverless-dynamodb-local","serverless-offline"],
  provider: {
    name: 'aws',
    region: "us-east-1",
    runtime: 'nodejs16.x',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps --stack-trace-limit=1000',
    },
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: ['dynamodb:PutItem', 'dynamodb:Scan', 'dynamodb:Query'],
        Resource: '*',
      },
      {
        Effect: 'Allow',
        Action: ['s3:PutObject'],
        Resource: '*'
      }
    ]
  },
  package: {
    individually: false,
    include: [
      'src/**',
    ]
  },
  functions: { 
    generateCertificate: {
      handler: 'src/functions/generateCertificate.handler',
      events: [
        {
          http: {
            method: 'post',
            path: 'generateCertificate',
            cors: true
          }
        }
      ]
    },
    verifyCertificate: {
      handler: 'src/functions/verifyCertificate.handler',
      events: [
        {
          http: {
            method: 'get',
            path: 'verifyCertificate/{id}',
            cors: true
          }
        }
      ]
    }
},
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
      external: ['chrome-aws-lambda'],
    },
    dynamodb: {
      stages: ['dev'],
      start: {
        port: 8000,
        inMemory: true,
        migrate: true,
        seed: true,
      },
    }
  },
  resources: {
    Resources: {
      dbCertificateUsers: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: 'users_certificate',
          AttributeDefinitions: [
            {
              AttributeName: 'id',
              AttributeType: 'S',
            },
          ],
          KeySchema: [
            {
              AttributeName: 'id',
              KeyType: 'HASH',
            },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          }
        },
      },
    }
  }
};

module.exports = serverlessConfiguration;
