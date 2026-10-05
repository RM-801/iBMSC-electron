// Commands share the renderer's existing handlers and unsaved-change checks.
function menuTemplate(
  send,
  recent = [],
  state = {},
  translate = (text) => text,
) {
  const item = (label, action, accelerator) => ({
    label: translate(label),
    accelerator,
    click: () => send(action),
  });
  const check = (label, action, checked, accelerator) => ({
    ...item(label, action, accelerator),
    type: "checkbox",
    checked,
  });
  const sep = { type: "separator" };
  return [
    {
      label: translate("iBMSC"),
      submenu: [
        item("关于 iBMSC", "about"),
        item("检查更新", "checkupdates"),
        sep,
        { role: "services", label: translate("服务") },
        sep,
        { role: "hide", label: translate("隐藏 iBMSC") },
        { role: "hideOthers", label: translate("隐藏其他应用") },
        { role: "unhide", label: translate("显示全部") },
        sep,
        { role: "quit", label: translate("退出 iBMSC") },
      ],
    },
    {
      label: translate("文件"),
      submenu: [
        item("新建", "new", "CmdOrCtrl+N"),
        item("打开…", "open", "CmdOrCtrl+O"),
        item("导入 .SM 文件", "importsm"),
        item("导入 .IBMSC 文件", "importibmsc"),
        sep,
        item("保存", "save", "CmdOrCtrl+S"),
        item("另存为…", "saveas", "CmdOrCtrl+Shift+S"),
        item("导出 .IBMSC…", "projectexport"),
        sep,
        {
          label: translate("最近打开"),
          submenu: recent.length
            ? recent.map((filename) => ({
                label: filename,
                click: () => send("openRecent", filename),
              }))
            : [{ label: translate("暂无最近文件"), enabled: false }],
        },
        item("导出 .IBMSCX…", "portableexport"),
        item("恢复自动保存", "recover"),
        item("打开 / 保存设置…", "fileoptions"),
        sep,
        { role: "close", label: translate("关闭窗口") },
      ],
    },
    {
      label: translate("编辑"),
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
        item("错误检查", "errorcheck"),
        sep,
        item("时间选择工具", "tool-time", "F1"),
        item("选择工具", "tool-select", "F2"),
        item("写入工具", "tool-write", "F3"),
        sep,
        item("MyO2 工具箱", "myo2"),
        item("BPM 计算…", "bpmtools"),
        item("完整 BMS 文本…", "sourceopen"),
      ],
    },
    {
      label: translate("选项"),
      submenu: [
        check("面条输入方式 - NT/BMSE", "toggleln", state.nt ?? true, "F8"),
        check("单击播放 Key 音", "previewclick", state.previewclick ?? true),
        check("Note 上显示文件名", "showfilename", state.showfilename ?? false),
        sep,
        item("音符输入设置…", "inputsettings"),
        item("常规设置…", "generalsettings"),
        item("外观设置…", "displaysettings"),
        item("语言…", "languagesettings"),
        item("皮肤…", "themesettings"),
        item("显示 / 隐藏操作面板", "toggle-options"),
      ],
    },
    {
      label: translate("转换"),
      submenu: [
        { ...item("转为长音符", "convert-long"), enabled: state.nt === false },
        item("转为短音符", "convert-short"),
        {
          ...item("长音符 ↔ 短音符", "convert-togglelong"),
          enabled: state.nt === false,
        },
        sep,
        item("转为隐藏音符", "convert-hidden"),
        item("转为可见音符", "convert-visible"),
        item("隐藏音符 ↔ 可见音符", "convert-togglehidden"),
        sep,
        item("修改编号…", "convert-value"),
        item("镜像", "convert-mirror"),
      ],
    },
    {
      label: translate("预览"),
      submenu: [
        item("从头播放", "play", "F5"),
        item("从指定小节播放", "playhere", "F6"),
        item("停止", "stop", "F7"),
      ],
    },
    {
      label: translate("窗口"),
      submenu: [
        { role: "minimize", label: translate("最小化") },
        { role: "zoom", label: translate("缩放窗口") },
        { role: "togglefullscreen", label: translate("切换全屏") },
        sep,
        { role: "front", label: translate("全部置于前面") },
      ],
    },
  ];
}
module.exports = { menuTemplate };
