const { Controller } = require('egg');

const ASSIGNMENT_ITEM_RE = /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/;

function parseAssignmentsString(str) {
  const map = new Map();

  if (!str || typeof str !== 'string') {
    return map;
  }
  str
    .split(',')
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .forEach((item) => {
      if (!ASSIGNMENT_ITEM_RE.test(item)) {
        return;
      }
      const idx = item.indexOf(':');
      const experiment = item.slice(0, idx);
      const group = item.slice(idx + 1);
      if (!map.has(experiment)) {
        map.set(experiment, group);
      }
    });
  return map;
}

function stringifyAssignments(map) {
  const items = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return items.map(([exp, grp]) => `${exp}:${grp}`).join(',');
}

function ensureValidItemsArray(ctx, items, allowEmpty) {
  if (!Array.isArray(items)) {
    ctx.throw(400, 'assignments/items must be an array');
  }

  if (!allowEmpty && items.length === 0) {
    ctx.throw(400, 'array must not be empty');
  }
}

class AbtestController extends Controller {
  async getAbTestAssignments() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    const record = await ctx.model.UserExtendInfo.findOne({
      raw: true,
      attributes: ['abTestAssignments'],
      where: { deviceId },
    });
    const value = (record && record.abTestAssignments) || '';
    ctx.body = { abTestAssignments: value };
  }

  async addAbTestAssignments() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    const { assignments } = ctx.request.body || {};
    ensureValidItemsArray(ctx, assignments, false);

    const seen = new Set();
    const toAdd = [];
    for (const raw of assignments) {
      if (typeof raw !== 'string') {
        ctx.throw(400, 'assignment must be a string');
      }
      const item = raw.trim();

      if (!ASSIGNMENT_ITEM_RE.test(item)) {
        ctx.throw(400, `invalid item: ${raw}`);
      }
      const idx = item.indexOf(':');
      const exp = item.slice(0, idx);
      const grp = item.slice(idx + 1);

      if (!seen.has(exp)) {
        seen.add(exp);
        toAdd.push([exp, grp]);
      }
    }

    const existing = await ctx.model.UserExtendInfo.findOne({ where: { deviceId } });
    const currentMap = parseAssignmentsString(existing && existing.abTestAssignments);

    let changed = false;
    for (const [exp, grp] of toAdd) {
      if (!currentMap.has(exp)) {
        currentMap.set(exp, grp);
        changed = true;
      }
    }

    const out = stringifyAssignments(currentMap);

    if (!changed) {
      ctx.body = { abTestAssignments: out };
      return;
    }

    if (existing) {
      await ctx.model.UserExtendInfo.update(
        { abTestAssignments: out, updateTime: app.Sequelize.fn('NOW') },
        { where: { deviceId } },
      );
      await ctx.model.UserExtendInfo.increment('updateCount', { by: 1, where: { deviceId } });
    } else {
      await ctx.model.UserExtendInfo.create({
        deviceId,
        abTestAssignments: out,
      });
    }
    ctx.body = { abTestAssignments: out };
  }

  async deleteAbTestAssignments() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    const { items } = ctx.request.body || {};
    ensureValidItemsArray(ctx, items, false);

    const existing = await ctx.model.UserExtendInfo.findOne({ where: { deviceId } });
    const currentMap = parseAssignmentsString(existing && existing.abTestAssignments);
    if (currentMap.size === 0) {
      ctx.body = { abTestAssignments: '' };
      return;
    }

    for (const raw of items) {
      if (typeof raw !== 'string') {
        continue;
      }
      const s = raw.trim();

      if (!s) {
        continue;
      }
      const key = s.includes(':') ? s.slice(0, s.indexOf(':')) : s;
      currentMap.delete(key);
    }

    const out = stringifyAssignments(currentMap);

    if (existing) {
      await ctx.model.UserExtendInfo.update(
        { abTestAssignments: out, updateTime: app.Sequelize.fn('NOW') },
        { where: { deviceId } },
      );
      await ctx.model.UserExtendInfo.increment('updateCount', { by: 1, where: { deviceId } });
    } else {
      await ctx.model.UserExtendInfo.create({ deviceId, abTestAssignments: out });
    }
    ctx.body = { abTestAssignments: out };
  }

  async replaceAbTestAssignments() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    const { assignmentsString, assignments } = ctx.request.body || {};

    let pairs = [];
    if (typeof assignmentsString === 'string') {
      const parts = assignmentsString
        .split(',')
        .map((s) => (s || '').trim())
        .filter(Boolean);
      pairs = parts;
    } else if (Array.isArray(assignments)) {
      pairs = assignments;
    } else if (assignmentsString === '') {
      pairs = [];
    } else {
      ctx.throw(400, 'must provide assignmentsString or assignments');
    }

    ensureValidItemsArray(ctx, pairs, true);

    const seen = new Set();
    const map = new Map();
    for (const raw of pairs) {
      if (typeof raw !== 'string') {
        ctx.throw(400, 'assignment must be a string');
      }
      const item = raw.trim();

      if (!ASSIGNMENT_ITEM_RE.test(item)) {
        ctx.throw(400, `invalid item: ${raw}`);
      }
      const idx = item.indexOf(':');
      const exp = item.slice(0, idx);
      const grp = item.slice(idx + 1);

      if (!seen.has(exp)) {
        seen.add(exp);
        map.set(exp, grp);
      }
    }

    const out = stringifyAssignments(map);

    const existing = await ctx.model.UserExtendInfo.findOne({ where: { deviceId } });
    if (existing) {
      await ctx.model.UserExtendInfo.update(
        { abTestAssignments: out, updateTime: app.Sequelize.fn('NOW') },
        { where: { deviceId } },
      );
      await ctx.model.UserExtendInfo.increment('updateCount', { by: 1, where: { deviceId } });
    } else {
      await ctx.model.UserExtendInfo.create({ deviceId, abTestAssignments: out });
    }
    ctx.body = { abTestAssignments: out };
  }

  async testip() {
    const { ctx } = this;
    const ip = ctx.helper.getRealIp();
    const country = await ctx.service.common.getCountryInfo();
    ctx.body = { ip, country };
  }
}

module.exports = AbtestController;
