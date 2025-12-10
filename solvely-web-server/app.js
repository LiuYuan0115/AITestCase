const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');
const firebaseAdmin = require('firebase-admin');

module.exports = (app) => {
  const awsConfig = app.config.aws.dynamoDB;
  const awsS3Config = app.config.aws.s3;
  const stripePrivateKey = app.config.stripeConfig.privateKey;
  const stripePrivateKeyV2 = app.config.stripeConfig.privateKeyV2;

  app.beforeStart(async () => {
    // 初始化实验配置
    // 从 CDN 获取配置
    const response = await app.curl(app.config.experimentConfig.configUrl, {
      dataType: 'json',
      timeout: 5000,
    });

    if (!response.data) {
      throw new Error('Failed to load experiment config');
    }
    // 将配置挂载到 app.context 上，使其在所有 ctx 中可用
    app.context.experimentConfig = {
      data: response.data,
      lastFetch: Date.now(),
    };

    app.coreLogger.info('Experiment config initialized and mounted to context');

    // 初始化其他服务
    const ddbClient = new DynamoDBClient(awsConfig);
    const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
    const s3Client = new S3Client(awsS3Config);
    const stripeClient = require('stripe');
    const stripe = stripeClient(stripePrivateKey);
    const stripeV2 = stripeClient(stripePrivateKeyV2);
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(app.config.firebaseConfig),
    });

    app.context.ddbDocClient = ddbDocClient;
    app.coreLogger.info('DynamoDB client initialized');
    app.context.s3Client = s3Client;
    app.coreLogger.info('S3 client initialized');
    app.context.stripe = stripe;
    app.coreLogger.info('Stripe client initialized');
    app.context.stripeV2 = stripeV2;
    app.coreLogger.info('StripeV2 client initialized');
    app.context.firebaseAdmin = firebaseAdmin;
    app.coreLogger.info('Firebase Admin initialized');
  });
};
