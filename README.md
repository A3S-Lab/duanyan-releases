# A3S-Lab/duanyan-releases

这个仓库只放**桌面端的安装包**，供手动下载安装：

- macOS（Apple Silicon）：`Duanyan-Breeding-Research-<版本>-arm64.dmg`
- Linux x86_64：`Duanyan-Science-Discovery-<版本>-x86_64.AppImage`

**源码不在这里，且保持私有。** 各个 Release 附带的 "Source code (zip / tar.gz)" 是 GitHub 按 tag
自动生成的，里面只有这份 README。

## 应用内更新不读这里

客户端「设置 → 检查更新」走的是中心的静态分发目录，不是这个仓库。这里是给人用的下载页，
也是应用在无法自动更新时「打开发布页」的落点。两者内容相同但用途不同，请不要据此以为
改动这里的文件会影响已装客户端的更新。

## 发布方式

由源码仓库的 `scripts/release-desktop.sh --with-github=A3S-Lab/duanyan-releases` 完成，
它会先送进中心分发目录、再镜像到这里。请不要手工改动这里的文件。
