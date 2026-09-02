/*!
 * EaglerBoost 性能增强 Mod  (perfmod.js)
 * ---------------------------------------------
 * 给本仓库的 EaglercraftX 1.12 (modernclient) 客户端注入三组优化：
 *
 *  1) 加载区块  —— LOD 渲染 + 更大的区块加载距离 + 区块修正
 *  2) 加载人物  —— 实体剔除 + 关闭实体阴影 + 显示自己的名字标签
 *  3) 提升 FPS  —— 关闭雨/粒子/附魔光效/云、降平滑光照与 mipmap、
 *                  开启方块面剔除/区块网格优化，并关闭调试堆栈去混淆以减少卡顿
 *
 * 原理（已按本仓库 wasm/ 内的客户端逐一核实）：
 *  - 游戏设置保存在 localStorage 的 `_eaglercraft_1.12.g` 键里，值为 base64(GZIP(key:value 行))
 *  - 本脚本在游戏启动前把增强预设直接写入该键（同时备份原设置），
 *    关闭时还原备份——不使用客户端 hooks 机制（该构建的 hooks 有 JSO null 崩溃问题）
 *  - eaglercraftXOpts 支持 enforceVSync / deobfStackTraces / checkGLErrors 等启动项
 *
 * 通过 URL 参数控制：?boost=1 开启（默认），?boost=0 关闭
 * ---------------------------------------------
 */
(function () {
  "use strict";

  // 本客户端实际的 localStorage 命名空间（从 classes.wasm 中核实）
  var STORAGE_NAMESPACE = "_eaglercraft_1.12";
  // 游戏设置键名
  var SETTINGS_KEY = "g";
  // 完整 localStorage 键
  var FULL_KEY = STORAGE_NAMESPACE + "." + SETTINGS_KEY;
  // 备份键（游戏不会读取这个键）
  var BACKUP_KEY = STORAGE_NAMESPACE + "." + SETTINGS_KEY + "_eaglerboost_backup";

  // 性能增强预设：base64(GZIP(设置文本))
  // 生成方式：设置文本按 `key:value` 逐行排列后 gzip + base64（与游戏端完全一致）
  var BOOST_SETTINGS_B64 =
    "H4sIAAAAAAAACm2QQW/CMAyF7/01jEnTlOM6wWUbE2hcJ5O61MJxosRZ6X79BIWKoB39Ptvv2c43GOWbfbNGaTCS7I3GjJWbwJawf6WkIBbN4/yGbBSiTui5iucVN4Jv6y7L4Ss0oJjMQ2VP5YKOo0frSzMUJR3qzDzFGKVNB43vk2mB09SdOt+vevkAhwrXRXBchGTmT7MKBXaM2zSIHVmAqGQZk5lX4M2schQchDf8QU5mVrUgdlhGCB3Zq9V4Uc0+N3fu4tdAUsQX/zlZlPqSSbSc37G3hwVYLM69wPOb3jF1q6Dk6BeUfOll45AU+MIxln8EJdn/z5w/7XrhHMs8bWbeRdp3WrSrV3S1z6J4N2CZQjgFH9U/AbYXakkCAAA=";

  function getURLParam(name) {
    try {
      var q = window.location.search;
      if (typeof q !== "string" || q.length < 1) return null;
      var params = new URLSearchParams(q);
      var v = params.get(name);
      return v === null ? null : v;
    } catch (ex) {
      return null;
    }
  }

  // 是否开启性能增强（默认开启）
  function isBoostEnabled() {
    var v = getURLParam("boost");
    if (v === null) return true; // 未指定时默认开启
    return v === "1" || v === "true" || v === "on";
  }

  // 安全获取 localStorage（隐私模式下可能不可用）
  function getStorage() {
    try {
      if (window.localStorage) return window.localStorage;
    } catch (ex) {}
    return null;
  }

  // 写入增强预设到游戏设置键，并备份原设置
  function applyBoostSettings() {
    var ls = getStorage();
    if (!ls) {
      console.warn("[EaglerBoost] localStorage 不可用，跳过设置注入。");
      return;
    }
    try {
      // 仅在没有备份时备份原设置（避免反复覆盖备份）
      var existing = ls.getItem(FULL_KEY);
      var backup = ls.getItem(BACKUP_KEY);
      if (backup === null && existing !== null) {
        ls.setItem(BACKUP_KEY, existing);
      }
      // 写入增强预设
      ls.setItem(FULL_KEY, BOOST_SETTINGS_B64);
      console.log(
        "[EaglerBoost] 性能增强设置已写入（原设置已备份到 " + BACKUP_KEY + "）。"
      );
    } catch (ex) {
      console.error("[EaglerBoost] 写入设置失败: " + ex);
    }
  }

  // 还原备份的原设置
  function restoreOriginalSettings() {
    var ls = getStorage();
    if (!ls) return;
    try {
      var backup = ls.getItem(BACKUP_KEY);
      if (backup !== null) {
        ls.setItem(FULL_KEY, backup);
        ls.removeItem(BACKUP_KEY);
        console.log("[EaglerBoost] 已还原原设置，性能增强已关闭。");
      } else {
        console.log("[EaglerBoost] 无备份可还原，保持当前设置。");
      }
    } catch (ex) {
      console.error("[EaglerBoost] 还原设置失败: " + ex);
    }
  }

  // 供 wasm/index.html 在创建 eaglercraftXOpts 之后调用
  window.__eaglerBoostApply = function (opts) {
    try {
      if (!opts || typeof opts !== "object") return;

      var boost = isBoostEnabled();

      // ---- 固定命名空间，保证与游戏端存储键一致 ----
      opts.localStorageNamespace = STORAGE_NAMESPACE;

      // ---- 启动/渲染层优化（这些项由客户端读取，安全）----
      // 强制 VSync：WASM-GC 端建议开启，避免事件循环被"跑太快"卡死输入
      opts.enforceVSync = true;
      // 关闭堆栈去混淆：减少日志时的微卡顿
      opts.deobfStackTraces = false;
      // 关闭 OpenGL 错误检查开销
      opts.checkGLErrors = false;
      opts.checkShaderGLErrors = false;
      // 用 MessageChannel 续帧，比 setTimeout(0) 更顺滑
      opts.useDelayOnSwap = false;
      // 正常使用 WebGL 扩展
      opts.useWebGLExt = true;

      // ---- 游戏设置注入（直接写 localStorage，不使用 hooks）----
      if (boost) {
        applyBoostSettings();
        console.log(
          "[EaglerBoost] 性能增强 Mod 已开启：LOD 区块渲染 / 实体加载优化 / FPS 提升。"
        );
      } else {
        restoreOriginalSettings();
        console.log(
          "[EaglerBoost] 性能增强 Mod 已关闭，已还原原设置。"
        );
      }
    } catch (ex) {
      // 任何异常都不允许影响游戏本体启动
      console.error("[EaglerBoost] 初始化失败（已忽略）: " + ex);
    }
  };
})();
