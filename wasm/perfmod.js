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
 *  - 客户端支持 eaglercraftXOpts.hooks.localStorageLoaded 钩子，
 *    返回非空 base64 时用它替代本地存储中的设置（无侵入、可随时关闭）
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

  // 性能增强预设：base64(GZIP(设置文本))
  // 生成方式：设置文本按 `key:value` 逐行排列后 gzip + base64（与游戏端完全一致）
  var BOOST_SETTINGS_B64 =
    "H4sIAAAAAAAACm2QTW/CMAyG7/k1rJOmKccxwWWDCTSuk0ldauE4UeKudL9+gkJFph3zPtH7YR9qTPLFod6g1JhIDlZTh8ZPYEfYv1JWEIf2sbojW4WkE3o26WJxJ4Rm3nZy/Iw1KGb7YNz5uaDTmNGEMgxFSYd5xzzVGKVtC3Xos22A8/Q7t6Ff97ICjwo3IzgtYrbV08ygwJ5xlwdxI4uQlBxjtpWBYGfGU/QQ3/AbOduZaUDcsEwQW3K3qHHRnENX/0mXsAGSor6Ejymi1JdMooW25+COC3BYrL3Cy5XeMbfrqOTpB5RCGeXSkBX4yjGVZwQlOfzPfDh7vXCXyjlNx7xPdGivNX8B8f/+dhgCAAA=";

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

  // 供 wasm/index.html 在创建 eaglercraftXOpts 之后调用
  window.__eaglerBoostApply = function (opts) {
    try {
      if (!opts || typeof opts !== "object") return;

      var boost = isBoostEnabled();

      // ---- 固定命名空间，保证与游戏端存储键一致 ----
      opts.localStorageNamespace = STORAGE_NAMESPACE;

      // ---- 启动/渲染层优化（这些项由客户端读取，100% 安全）----
      // 强制 VSync：WASM-GC 端建议开启，避免事件循环被“跑太快”卡死输入
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

      if (boost) {
        // ---- 注入游戏设置：通过 localStorageLoaded 钩子返回增强预设 ----
        opts.hooks = opts.hooks || {};
        var origLoad = opts.hooks.localStorageLoaded;
        opts.hooks.localStorageLoaded = function (key) {
          if (key === STORAGE_NAMESPACE + "." + SETTINGS_KEY) {
            return BOOST_SETTINGS_B64;
          }
          if (typeof origLoad === "function") return origLoad(key);
          return null;
        };

        console.log(
          "[EaglerBoost] 性能增强 Mod 已开启：LOD 区块渲染 / 实体加载优化 / FPS 提升 已注入。"
        );
      } else {
        console.log(
          "[EaglerBoost] 性能增强 Mod 已关闭，使用客户端默认/原有设置。"
        );
      }
    } catch (ex) {
      // 任何异常都不允许影响游戏本体启动
      console.error("[EaglerBoost] 初始化失败（已忽略）: " + ex);
    }
  };
})();
