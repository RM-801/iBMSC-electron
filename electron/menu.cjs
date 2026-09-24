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
        item("导出 .IBMSCX…", "portableexport"),
        item("恢复自动保存", "recover"),
        item("打开 / 保存设置…", "fileoptions"),
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
        sep,
        item("时间选择工具", "tool-time", "F1"),
        item("选择工具", "tool-select", "F2"),
        item("写入工具", "tool-write", "F3"),
        item("音符输入设置…", "inputsettings"),
        item("BPM 计算…", "bpmtools"),
        item("完整 BMS 文本…", "sourceopen"),
      ],
    },
    {
      label: "选项",
      submenu: [
        item("错误检查…", "errorcheck"),
        item("切换 NT / BMSE", "toggleln", "F8"),
        item("切换点击试听", "previewclick"),
        item("切换音源文件名显示", "showfilename"),
        sep,
        item("常规设置…", "generalsettings"),
        item("显示设置…", "displaysettings"),
        item("播放器设置…", "playersettings"),
        item("语言…", "languagesettings"),
        item("皮肤 / 主题…", "themesettings"),
        item("显示 / 隐藏操作面板", "toggle-options"),
      ],
    },
    {
      label: "转换",
      submenu: [
        item("转为长音符", "convert-long"),
        item("转为短音符", "convert-short"),
        item("转为隐藏音符", "convert-hidden"),
        item("转为可见音符", "convert-visible"),
        item("修改编号…", "convert-value"),
        item("镜像", "convert-mirror"),
      ],
    },
    {
      label: "预览",
      submenu: [
        item("从头播放", "play", "F5"),
        item("从指定小节播放", "playhere", "F6"),
        item("停止", "stop", "F7"),
        sep,
        item("外部播放器：从头播放", "externalbegin"),
        item("外部播放器：从指定小节播放", "externalhere"),
        item("停止外部播放器", "externalstop"),
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
