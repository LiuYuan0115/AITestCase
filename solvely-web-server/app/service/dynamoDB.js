const { Service } = require('egg');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDBService extends Service {
  // 创建项目并添加 createTime 和 updateTime
  async create(tableName, item) {
    const now = new Date().toISOString();
    const params = {
      TableName: tableName,
      Item: {
        ...item,
        createTime: now,
        updateTime: now,
      },
    };
    await this.ctx.ddbDocClient.send(new PutCommand(params));
    return params.Item;
  }

  // 通过键获取项目
  async get(tableName, key) {
    const params = {
      TableName: tableName,
      Key: key,
    };
    const { Item } = await this.ctx.ddbDocClient.send(new GetCommand(params));
    return Item;
  }

  async queryByDeviceId(tableName, deviceId) {
    const params = {
      TableName: tableName,
      IndexName: 'deviceId-index', // GSI 的名称
      KeyConditionExpression: 'deviceId = :deviceId',
      FilterExpression: 'attribute_not_exists(deleteTime)', // 过滤条件
      ExpressionAttributeValues: {
        ':deviceId': deviceId,
      },
      ProjectionExpression:
        'quizId, title, questionType, questionCount, subject, quizStatus, createTime',
    };

    let items = [];
    try {
      let lastEvaluatedKey = null;
      do {
        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }
        const result = await this.ctx.ddbDocClient.send(new QueryCommand(params));
        items = items.concat(result.Items);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      return items;
    } catch (error) {
      throw new Error(`Error querying all items by deviceId: ${error}`);
    }
  }

  // 更新项目并更新 updateTime
  async update(
    tableName,
    key,
    updateExpression,
    expressionAttributeValues,
    expressionAttributeNames = {},
  ) {
    const now = new Date().toISOString();
    let fullUpdateExpression = updateExpression;

    if (
      !updateExpression.startsWith('REMOVE') ||
      Object.keys(expressionAttributeValues).length > 0
    ) {
      fullUpdateExpression += ', updateTime = :updateTime';
      expressionAttributeValues[':updateTime'] = now;
    }

    const params = {
      TableName: tableName,
      Key: key,
      UpdateExpression: fullUpdateExpression,
      ReturnValues: 'UPDATED_NEW',
    };
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    try {
      const output = await this.ctx.ddbDocClient.send(new UpdateCommand(params));
      return output.Attributes;
    } catch (error) {
      throw new Error(`更新失败: ${error.message}`);
    }
  }

  // 更新项目的deleteTime为当前时间
  async delete(tableName, key) {
    const now = new Date().toISOString();
    const params = {
      TableName: tableName,
      Key: key,
      UpdateExpression: 'SET deleteTime = :deleteTime',
      ExpressionAttributeValues: {
        ':deleteTime': now,
      },
    };
    await this.ctx.ddbDocClient.send(new UpdateCommand(params));
  }
}

module.exports = DynamoDBService;
