using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// Windows Common Item Dialog: the encoding control belongs to the native save
// dialog, below the file type field. This helper selects a path; it never writes
// the chart. Electron remains responsible for encoding checks and atomic writes.
class SaveDialog {
    public class Request {
        public string owner;
        public string defaultPath;
        public string format;
        public string encoding;
        public string title;
        public string encodingLabel;
    }
    [STAThread]
    static int Main(string[] args) {
        Console.SetIn(new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)));
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)) { AutoFlush = true });
        var json = new JavaScriptSerializer();
        object instance = null;
        try {
            bool check = args.Length == 1 && args[0] == "--self-test";
            var request = check ? new Request { format = "bms", encoding = "utf8" }
                : json.Deserialize<Request>(Console.In.ReadToEnd());
            instance = Activator.CreateInstance(Type.GetTypeFromCLSID(
                new Guid("C0B4E2F3-BA21-4773-8DBA-335EC946EB8B")));
            var dialog = (IFileDialog)instance;
            var custom = (IFileDialogCustomize)instance;
            string format = request.format == "pms" ? "pms" : "bms";
            dialog.SetFileTypes(1, new Filter[] { new Filter {
                name = format.ToUpperInvariant(),
                pattern = format == "pms" ? "*.pms" : "*.bms;*.bme;*.bml"
            }});
            dialog.SetDefaultExtension(format);
            // OVERWRITEPROMPT | STRICTFILETYPES | FORCEFILESYSTEM | PATHMUSTEXIST
            // | NOREADONLYRETURN. The OS handles overwrite confirmation.
            dialog.SetOptions(0x2 | 0x4 | 0x40 | 0x800 | 0x8000);
            dialog.SetTitle(request.title ?? "另存为");
            custom.StartVisualGroup(100, request.encodingLabel ?? "编码(&E):");
            custom.AddComboBox(101);
            custom.AddControlItem(101, 0, "UTF-8");
            custom.AddControlItem(101, 1, "Shift-JIS");
            custom.SetSelectedControlItem(101,
                request.encoding == "shift_jis" ? 1u : 0u);
            custom.EndVisualGroup();
            if (check) {
                uint selected;
                custom.GetSelectedControlItem(101, out selected);
                Console.Write(json.Serialize(new { ok = selected == 0 }));
                return selected == 0 ? 0 : 1;
            }
            if (!String.IsNullOrEmpty(request.defaultPath)) {
                dialog.SetFileName(Path.GetFileName(request.defaultPath));
                string folder = Path.GetDirectoryName(request.defaultPath);
                if (!String.IsNullOrEmpty(folder) && Directory.Exists(folder)) {
                    IShellItem item;
                    Guid iid = typeof(IShellItem).GUID;
                    SHCreateItemFromParsingName(folder, IntPtr.Zero, ref iid, out item);
                    try { dialog.SetFolder(item); }
                    finally { Marshal.ReleaseComObject(item); }
                }
            }
            long owner;
            Int64.TryParse(request.owner, out owner);
            int result = dialog.Show(new IntPtr(owner));
            if (result == unchecked((int)0x800704C7)) {
                Console.Write("{\"canceled\":true}");
                return 0;
            }
            Marshal.ThrowExceptionForHR(result);
            IShellItem chosen;
            dialog.GetResult(out chosen);
            string filename;
            try { chosen.GetDisplayName(0x80058000, out filename); }
            finally { Marshal.ReleaseComObject(chosen); }
            uint encoding;
            custom.GetSelectedControlItem(101, out encoding);
            Console.Write(json.Serialize(new {
                canceled = false, filePath = filename,
                encoding = encoding == 1 ? "shift_jis" : "utf8"
            }));
            return 0;
        } catch (Exception error) {
            Console.Error.Write(error.Message);
            return 1;
        } finally {
            if (instance != null) Marshal.ReleaseComObject(instance);
        }
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string path, IntPtr bind,
        ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct Filter {
        [MarshalAs(UnmanagedType.LPWStr)] public string name;
        [MarshalAs(UnmanagedType.LPWStr)] public string pattern;
    }
    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItem {
        void BindToHandler(IntPtr bind, ref Guid handler, ref Guid iid, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint name, [MarshalAs(UnmanagedType.LPWStr)] out string result);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem other, uint hint, out int order);
    }
    // COM methods must stay in the order declared in shobjidl_core.h.
    [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileDialog {
        [PreserveSig] int Show(IntPtr owner);
        void SetFileTypes(uint count, [MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 0)] Filter[] filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetResult(out IShellItem item);
        void AddPlace(IShellItem item, uint placement);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }
    [ComImport, Guid("E6FDD21A-163F-4975-9C8C-A69F1BA37034"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileDialogCustomize {
        void EnableOpenDropDown(uint id);
        void AddMenu(uint id, [MarshalAs(UnmanagedType.LPWStr)] string label);
        void AddPushButton(uint id, [MarshalAs(UnmanagedType.LPWStr)] string label);
        void AddComboBox(uint id);
        void AddRadioButtonList(uint id);
        void AddCheckButton(uint id, [MarshalAs(UnmanagedType.LPWStr)] string label, bool check);
        void AddEditBox(uint id, [MarshalAs(UnmanagedType.LPWStr)] string text);
        void AddSeparator(uint id);
        void AddText(uint id, [MarshalAs(UnmanagedType.LPWStr)] string text);
        void SetControlLabel(uint id, [MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetControlState(uint id, out uint state);
        void SetControlState(uint id, uint state);
        void GetEditBoxText(uint id, [MarshalAs(UnmanagedType.LPWStr)] out string text);
        void SetEditBoxText(uint id, [MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetCheckButtonState(uint id, out bool check);
        void SetCheckButtonState(uint id, bool check);
        void AddControlItem(uint id, uint item, [MarshalAs(UnmanagedType.LPWStr)] string label);
        void RemoveControlItem(uint id, uint item);
        void RemoveAllControlItems(uint id);
        void GetControlItemState(uint id, uint item, out uint state);
        void SetControlItemState(uint id, uint item, uint state);
        void GetSelectedControlItem(uint id, out uint item);
        void SetSelectedControlItem(uint id, uint item);
        void StartVisualGroup(uint id, [MarshalAs(UnmanagedType.LPWStr)] string label);
        void EndVisualGroup();
        void MakeProminent(uint id);
        void SetControlItemText(uint id, uint item, [MarshalAs(UnmanagedType.LPWStr)] string label);
    }
}
