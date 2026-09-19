// Commands share the renderer's existing handlers and unsaved-change checks.
function menuTemplate(send, recent = []) {
  const item = (label, action, accelerator) => ({
    label,
    accelerator,
    click: () => send(action),
  });
  const sep = { type: "separator" };
  return [
    {
      label: "iBMSC",
      submenu: [
        item("关于 iBMSC", "about"),
        sep,
        { role: "services", label: "服务" },
        sep,
        { role: "hide", label: "隐藏 iBMSC" },
        { role: "hideOthers", label: "隐藏其他应用" },
        { role: "unhide", label: "显示全部" },
        sep,
        { role: "quit", label: "退出 iBMSC" },
      ],
    },
    {
      label: "文件",
      submenu: [
        item("新建", "new", "CmdOrCtrl+N"),
        item("打开…", "open", "CmdOrCtrl+O"),
        {
          label: "最近打开",
          submenu: recent.length
            ? recent.map((filename) => ({
                label: filename,
                click: () => send("openRecent", filename),
              }))
            : [{ label: "暂无最近文件", enabled: false }],
        },
        sep,
        item("保存", "save", "CmdOrCtrl+S"),
        item("另存为…", "saveas", "CmdOrCtrl+Shift+S"),
        item("导出 .IBMSC…", "projectexport"),
        item("保存移植版工程…", "portableexport"),
        item("恢复自动保存", "recover"),
        sep,
        { role: "close", label: "关闭窗口" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        item("撤销", "undo", "CmdOrCtrl+Z"),
        item("重做", "redo", "CmdOrCtrl+Shift+Z"),
        sep,
        item("剪切", "cutnotes", "CmdOrCtrl+X"),
        item("复制", "copynotes", "CmdOrCtrl+C"),
        item("粘贴", "pastenotes", "CmdOrCtrl+V"),
        item("删除", "deletenotes"),
        item("全选", "selectall", "CmdOrCtrl+A"),
        sep,
        item("查找 / 删除 / 替换…", "findopen", "CmdOrCtrl+F"),
        item("统计…", "statistics", "CmdOrCtrl+T"),
      ],
    },
    {
      label: "选项",
      submenu: [
        item("错误检查…", "errorcheck"),
        item("导入主题…", "themeimport"),
        item("显示 / 隐藏操作面板", "toggle-options"),
      ],
    },
    { label: "转换", submenu: [item("转换选中音符", "convertnotes")] },
    {
      label: "预览",
      submenu: [
        item("从头播放", "play", "F5"),
        item("从指定小节播放", "playhere", "F6"),
        item("停止", "stop", "F7"),
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放窗口" },
        { role: "togglefullscreen", label: "切换全屏" },
        sep,
        { role: "front", label: "全部置于前面" },
      ],
    },
  ];
}
module.exports = { menuTemplate };
