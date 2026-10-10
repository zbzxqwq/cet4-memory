/* =========================================================================
 *  四级记忆 · Windows 启动器 (EXE)
 *  把网页版打包成一个可以双击运行的 Windows 程序。
 *
 *  做法：
 *    1. 把 index.html / app.js / words.js / 图标 等作为“资源”编译进 exe；
 *    2. 第一次运行时把它们解压到：%LOCALAPPDATA%\四级记忆\app\
 *    3. 用 Edge / Chrome 的“应用模式”打开，看起来就是一个独立软件。
 *
 *  学习记录保存在浏览器里（每个用户一份），升级程序不会丢。
 * ========================================================================= */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

static class Launcher
{
    const string AppName = "四级记忆";

    static readonly string[] Assets = {
        "index.html",
        "app.js",
        "words.js",
        "manifest.json",
        "sw.js",
        "icon-192.png",
        "icon-512.png",
        "favicon.png"
    };

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            string appDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppName, "app");
            Directory.CreateDirectory(appDir);

            ExtractAssets(appDir);

            string page = Path.Combine(appDir, "index.html");
            if (!File.Exists(page))
            {
                MessageBox.Show("找不到程序文件，无法启动。", AppName,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            string browser = FindBrowser();
            string url = new Uri(page).AbsoluteUri;
            string profile = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppName, "profile");

            if (browser != null)
            {
                var psi = new ProcessStartInfo(browser);
                psi.Arguments = "--app=\"" + url + "\" --user-data-dir=\"" + profile +
                                "\" --no-first-run --no-default-browser-check";
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            else
            {
                // 没有 Edge/Chrome 时，用系统默认浏览器打开
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show("启动失败：" + ex.Message, AppName,
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    /* 把内嵌资源写到磁盘（内容不一致才覆盖，保留用户数据） */
    static void ExtractAssets(string appDir)
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        foreach (string name in Assets)
        {
            using (Stream src = asm.GetManifestResourceStream(name))
            {
                if (src == null) continue;
                string target = Path.Combine(appDir, name);
                byte[] data;
                using (var ms = new MemoryStream())
                {
                    src.CopyTo(ms);
                    data = ms.ToArray();
                }
                if (File.Exists(target) && SameBytes(target, data)) continue;
                File.WriteAllBytes(target, data);
            }
        }
    }

    static bool SameBytes(string path, byte[] data)
    {
        try
        {
            var fi = new FileInfo(path);
            if (fi.Length != data.Length) return false;
            byte[] old = File.ReadAllBytes(path);
            for (int i = 0; i < old.Length; i++)
                if (old[i] != data[i]) return false;
            return true;
        }
        catch { return false; }
    }

    /* 依次查找 Edge / Chrome */
    static string FindBrowser()
    {
        var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var pf64 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        var candidates = new List<string>
        {
            Path.Combine(pf,    @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf64,  @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,    @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf64,  @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe")
        };
        foreach (string c in candidates)
            if (File.Exists(c)) return c;
        return null;
    }
}
