const { Service } = require('egg');
const _ = require('lodash');

class YoutubeService extends Service {
  /**
   * 获取 YouTube 视频摘要
   * @param {string} deviceId 设备ID
   * @param {Object} subtitles 字幕数据
   * @param {string} videoId 视频ID
   * @param {string} lang 语言
   * @return {Promise<Object>} 摘要数据
   */
  async getYouTubeSummaryOutline(deviceId, subtitles, videoId) {
    const { ctx, app } = this;

    ctx.service.point.firebasePoint(deviceId, 'youtube_summary_title', { videoId });

    // 次数检查 + 次数扣除逻辑
    const subscription = await ctx.service.subscription.findActiveSubscription();

    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved } = await ctx.service.balance.checkBalance(deviceId, 'plugin');
      if (!approved) {
        throw new Error('用户余额不足');
      }
    }

    // 获取视频摘要 public api
    try {
      const commonHost = app.config.commonServiceConfig.host;
      const result = await ctx.curl(
        `${commonHost}/solvelyPubServer/v1/plugin/youtube/subtitle/summaryTitle`,
        {
          method: 'POST',
          data: {
            deviceId,
            text: subtitles,
            videoId,
            platform: 'plugin',
          },
          contentType: 'json',
          dataType: 'json',
        },
      );
      if (result.data.statusCode === 200) {
        ctx.service.point.posthogPoint(deviceId, 'youtube_summary_title_success', {
          videoId,
        });
        return { outline: result.data.data.text };
      }
      throw new Error('获取视频摘要失败');
    } catch (error) {
      ctx.service.point.posthogPoint(deviceId, 'youtube_summary_title_error', {
        videoId,
        message: error?.message,
      });
      throw new Error('获取视频摘要失败');
    }
  }

  /**
   * 按时间分片字幕数据
   * @param {string} subtitlesJson 字幕 JSON 字符串
   * @return {Array} 分片后的字幕数组
   */
  chunkSubtitlesByTime(subtitlesJson) {
    try {
      const subtitles = JSON.parse(subtitlesJson);
      if (!Array.isArray(subtitles) || subtitles.length === 0) {
        return [subtitlesJson]; // 如果不是数组或为空，返回原始数据
      }

      // 计算动态分片时长
      let dynamicChunkDuration = 600; // 默认值
      let totalDurationInSeconds = 0;
      try {
        // 从最后一个字幕项获取总时长
        const lastSubtitle = subtitles[subtitles.length - 1];
        totalDurationInSeconds = lastSubtitle.start + lastSubtitle.dur;

        // 转换为分钟并开根号，限制在5-10分钟范围
        const totalDurationInMinutes = totalDurationInSeconds / 60;
        const chunkDurationInMinutes = Math.max(5, Math.min(10, Math.sqrt(totalDurationInMinutes)));

        // 转换回秒数
        dynamicChunkDuration = chunkDurationInMinutes * 60;
      } catch (err) {
        // 如果计算失败，使用默认值
      }

      const chunks = [];
      let currentChunk = [];
      let chunkStartTime = 0;

      for (const subtitle of subtitles) {
        const { start } = subtitle;

        // 如果当前字幕的开始时间超过了分片时长，创建新分片
        if (start >= chunkStartTime + dynamicChunkDuration && currentChunk.length > 0) {
          chunks.push(JSON.stringify(currentChunk));
          currentChunk = [];
          chunkStartTime = Math.floor(start / dynamicChunkDuration) * dynamicChunkDuration;
        }

        currentChunk.push(subtitle);
      }

      // 添加最后一个分片
      if (currentChunk.length > 0) {
        chunks.push(JSON.stringify(currentChunk));
      }

      return chunks.length > 0 ? chunks : [subtitlesJson];
    } catch (error) {
      // 解析失败，返回原始数据
      return [subtitlesJson];
    }
  }

  /**
   * 清理分片数据的内部引用关系
   * @param {Array} chunkResults 所有分片的结果数组
   * @return {Array} 清理后的分片结果数组
   */
  cleanupChunkReferences(chunkResults) {
    return chunkResults.map((chunkResult) => {
      if (!chunkResult.data || !Array.isArray(chunkResult.data)) {
        return chunkResult;
      }

      const chunkData = chunkResult.data;

      // 收集当前分片中所有 SECOND_SUMMARY 节点的 ID
      const availableSubsectionIds = new Set();
      for (const item of chunkData) {
        if (item.type === 'SECOND_SUMMARY' && item.id) {
          availableSubsectionIds.add(item.id);
        }
      }

      // 清理 FIRST_SUMMARY 节点的 subsections 引用
      for (const item of chunkData) {
        if (item.type === 'FIRST_SUMMARY' && Array.isArray(item.subsections)) {
          // 只保留在当前分片中确实存在的 ID
          item.subsections = item.subsections.filter((id) => availableSubsectionIds.has(id));
        }
      }

      return chunkResult;
    });
  }

  /**
   * 重新编号分片数据的 ID 并合并
   * @param {Array} allChunkResults 所有分片的结果数组 (每个元素是 {data: [...]} 格式)
   * @return {Array} 重新编号后的合并数组
   */
  renumberChunkIds(allChunkResults) {
    let combinedData = [];
    let sectionCounter = 1;
    let subsectionCounter = 1;

    // 遍历每个分片的结果
    for (const chunkResult of allChunkResults) {
      if (!chunkResult.data || !Array.isArray(chunkResult.data)) {
        continue;
      }

      const chunkData = chunkResult.data;
      const idMapping = {}; // 当前分片的 ID 映射表

      // 第一遍：重新分配所有 ID，构建映射表
      for (const item of chunkData) {
        if (item.type === 'FIRST_SUMMARY') {
          const newId = `section_${sectionCounter.toString().padStart(3, '0')}`;
          idMapping[item.id] = newId;
          item.id = newId;
          sectionCounter++;
        } else if (item.type === 'SECOND_SUMMARY') {
          const newId = `subsection_${subsectionCounter.toString().padStart(3, '0')}`;
          idMapping[item.id] = newId;
          item.id = newId;
          subsectionCounter++;
        }
      }

      // 第二遍：更新主段落的 subsections 引用
      for (const item of chunkData) {
        if (item.type === 'FIRST_SUMMARY' && Array.isArray(item.subsections)) {
          item.subsections = item.subsections.map((oldId) => idMapping[oldId] || oldId);
        }
      }

      // 添加到最终结果
      combinedData = combinedData.concat(chunkData);
    }

    return combinedData;
  }

  /**
   * 处理单个分片的数据完整性检查
   * @param {Array} dataArray 分片数据数组
   * @param {string} videoId 视频ID
   * @return {Array} 处理后的数据数组
   */
  processChunkDataIntegrity(dataArray, videoId) {
    const { ctx } = this;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return [];
    }

    const requiredKeys = ['end_time', 'id', 'start_time', 'subsections', 'text', 'title', 'type'];

    const lastItem = dataArray[dataArray.length - 1];

    // 检查最后一个对象是否包含所有必需的key
    const hasAllKeys = requiredKeys.every((key) => lastItem.hasOwnProperty(key));

    if (!hasAllKeys) {
      // 移除最后一个不完整的对象
      dataArray.pop();
      ctx.logger.warn(`移除了不完整的对象，videoId: ${videoId}`);
    }

    return dataArray;
  }

  /**
   * 获取 YouTube 视频总结详情
   * @param {string} deviceId 设备ID
   * @param {Object} subtitles 字幕数据
   * @param {string} videoId 视频ID
   * @param {string} lang 语言
   * @return {Promise<Object>} 总结详情数据
   */
  async getYouTubeSummaryDetails(deviceId, subtitles, videoId) {
    const { ctx, app } = this;

    ctx.service.point.firebasePoint(deviceId, 'youtube_summary_details', { videoId });

    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        throw new Error('用户余额不足');
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    // 对字幕进行分片处理
    const subtitleChunks = this.chunkSubtitlesByTime(subtitles);

    try {
      const commonHost = app.config.commonServiceConfig.host;

      // 并发请求所有分片
      const chunkPromises = subtitleChunks.map(async (chunkSubtitles) => {
        const result = await ctx.curl(
          `${commonHost}/solvelyPubServer/v1/plugin/youtube/subtitle/summaryText`,
          {
            method: 'POST',
            data: {
              deviceId,
              text: chunkSubtitles,
              videoId,
              platform: 'plugin',
            },
            contentType: 'json',
            dataType: 'json',
          },
        );

        const { statusCode, data } = result.data;

        if (statusCode !== 200) {
          if (result?.data?.data?.message?.includes('ResponsibleAIPolicyViolation')) {
            throw new Error('ResponsibleAIPolicyViolation');
          }
          throw new Error('API_ERROR');
        }

        return data;
      });

      // 等待所有分片请求完成
      const chunkResults = await Promise.all(chunkPromises);

      // 清理分片内部的引用关系
      const cleanedChunkResults = this.cleanupChunkReferences(chunkResults);

      // 重新编号 ID 并合并数据
      let combinedData = this.renumberChunkIds(cleanedChunkResults);

      // 处理数据完整性检查
      combinedData = this.processChunkDataIntegrity(combinedData, videoId);

      // 合并所有分片的统计信息
      let totalCompletionToken = 0;
      let hasAnyFill = false;

      for (const chunkData of cleanedChunkResults) {
        if (chunkData.completionToken) {
          totalCompletionToken += chunkData.completionToken;
        }

        if (chunkData.isFill) {
          hasAnyFill = true;
        }
      }

      // 记录成功埋点
      ctx.service.point.firebasePoint(deviceId, 'youtube_summary_details_success', {
        videoId,
        isFill: hasAnyFill,
        completionToken: totalCompletionToken,
        chunkCount: subtitleChunks.length,
      });
      ctx.service.point.posthogPoint(deviceId, 'youtube_summary_details_success', {
        videoId,
        isFill: hasAnyFill,
        completionToken: totalCompletionToken,
        chunkCount: subtitleChunks.length,
      });

      return { details: combinedData, chunkResults };
    } catch (error) {
      ctx.service.point.firebasePoint(deviceId, 'youtube_summary_details_error', {
        videoId,
        message: error?.message,
      });
      ctx.service.point.posthogPoint(deviceId, 'youtube_summary_details_error', {
        videoId,
        message: error?.message,
      });
      throw new Error(error?.message);
    }
  }
}

module.exports = YoutubeService;
