# A3S-Lab/duanyan-releases

这个仓库只放**桌面端的安装包与更新元数据**（`Duanyan-Science-Discovery-<版本>-x86_64.AppImage`
与 `latest-linux.yml`），源码在别处、保持私有。

客户端「设置 → 检查更新」从这里读取 `latest-linux.yml`，校验 sha512 后替换当前 AppImage。
发布由源码仓库的 `scripts/release-desktop.sh` 完成，请不要手工改动这里的文件。
