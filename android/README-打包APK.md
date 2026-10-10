# 打包安卓 APK

网页版已经做好了，安卓包只是把它装进一个壳里。**这一步需要联网下载工具**，请让家长或老师帮忙。

---

## 一、先装好这三样东西（只装一次）

1. **Node.js** —— <https://nodejs.org> 下载 LTS 版，一路「下一步」。
2. **JDK 17** —— 推荐 Adoptium 的 Temurin 17：<https://adoptium.net>
3. **Android Studio** —— <https://developer.android.com/studio>
   - 安装时勾选 **Android SDK**、**Android SDK Platform-Tools**。
   - 装完后打开一次 Android Studio，让它把 SDK 下载完。
   - 在 Android Studio 里：`More Actions → SDK Manager → SDK Tools`，勾选 **Android SDK Command-line Tools**。

装好后打开 PowerShell，输入下面两条，能打印出版本号就说明成功了：

```powershell
node -v
java -version
```

---

## 二、打包（三步）

在 PowerShell 里，进到本文件夹（`android`）：

```powershell
cd "D:\deepseek本地\四级记忆\android"

npm install
npm run sync
npm run add:android
```

然后打包：

```powershell
cd android
.\gradlew.bat assembleDebug
```

第一次会下载不少东西，耐心等几分钟。

---

## 三、APK 在哪里

编译成功后，文件在这里：

```
D:\deepseek本地\四级记忆\android\android\app\build\outputs\apk\debug\app-debug.apk
```

把这个 `app-debug.apk` 传到手机上，点开安装（需要允许「安装未知来源应用」）。

桌面上会出现「四级记忆」的图标，图标就是我们做好的蓝色小方块。

---

## 四、不想装这么多东西？用这个更简单的办法

**把网页版直接装到手机上**，效果几乎一样，还不用装任何开发工具：

1. 把 `index.html`、`app.js`、`words.js`、`manifest.json`、`sw.js`、两个 `icon-*.png` 一起拷到手机的一个文件夹里；
2. 用手机浏览器（Chrome / Edge）打开 `index.html`；
3. 点浏览器右上角菜单 → **「添加到主屏幕」**；
4. 桌面上就多了一个「四级记忆」图标，点开是全屏的，和 App 一样。

**区别**：这种方式的发音和记录只在手机浏览器里，换浏览器记录不会跟着走。
如果只是想在手机上背单词，这个办法最省事。

---

## 五、常见问题

**Q：`npx cap add android` 报错找不到 SDK？**
A：打开 Android Studio 装一次 SDK，然后设置环境变量：

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

关掉 PowerShell 重新打开再试。

**Q：`gradlew.bat` 报 JAVA_HOME 错误？**
A：装好 JDK 17 后设置：

```powershell
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
```

（路径按你实际装的版本改。）

**Q：只想先看看效果，不想打包？**
A：那就直接用第四节的「添加到主屏幕」办法。
