# 物流站 · 建筑外观与装卸作业模拟

根据一张建筑照片制作的三维外观模型，以及可交互的物流装卸示意动画。包含本地运行的网页、GLB 模型、Blender 源文件和生成脚本。

![建筑模型预览](building-preview.png)

## 克隆后直接查看

需要 Node.js 20 或更新版本，以及支持 WebGL 的现代浏览器。查看现成模型无需安装 Blender，无需 API Key，无需运行建模脚本，也无需 `npm install` 或构建。

```sh
git clone https://github.com/Cedric0927/logistics-building-3d.git
cd logistics-building-3d
npm start
```

打开 **http://127.0.0.1:4176/**。

- 默认展示货车装卸作业：驶入 → 倒车靠台 → 开门 → 叉车逐托卸货 → 关门 → 驶离。一轮 97 秒，三托货物。
- 点击“开始作业”，支持暂停 / 继续、重置、下一阶段、0.5×–4× 速度和拖动时间轴回看。
- 可切换场院全景、装卸近景和俯视动线，支持鼠标旋转、缩放和平移。
- 可切换车厢剖视，查看货物状态；可勾选循环演示。空格键暂停 / 继续，R 重置。
- 原始建筑查看器保留在 `building.html`，支持 GLB 下载、打开其他 GLB、正面与屋顶视角。

请通过本地服务器访问，直接双击 HTML 会受到浏览器本地文件限制。若 4176 端口已被占用，可指定其他端口：

```powershell
# Windows PowerShell
$env:PORT=4177
npm start
```

```sh
# macOS / Linux
PORT=4177 npm start
```

网页查看组件、模型、贴图和照片全部包含在仓库中。克隆完成后，查看模型不依赖网络、CDN 或外部服务。可以把整个目录放到静态 Web 服务器中展示；GitHub 仓库文件页面本身不会执行网页。

## 包含的文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 与本地预览一致的交互网页 |
| `app.mjs` / `simulation.css` | Three.js 作业场景、可运动设备及控制面板 |
| `simulation.mjs` | 可回放的确定性作业时间轴 |
| `simulation.test.mjs` | 货物守恒、作业顺序与边界连续性测试 |
| `building.html` | 原始静态建筑查看器 |
| `logistics-building.glb` | 约 3.9 MB 的网页模型，内嵌贴图 |
| `logistics-building.blend` | 可编辑 Blender 源文件 |
| `reference.jpg` | 用户提供的建模参考照片 |
| `building-preview.png` | 模型渲染预览 |
| `create-building.py` | Blender 建模、导出和渲染脚本 |
| `facade-tiles.png` / `glass-reflection.png` | 脚本生成的材质贴图 |
| `building-info.json` | 模型规模与估算尺寸说明 |
| `vendor/` | Three.js 0.186.1 与 model-viewer 4.4.0 组件及许可证 |
| `asset-manifest.json` | 展示文件 SHA-256 校验值 |

## 验证克隆是否完整

```sh
npm test
```

检查展示文件的 SHA-256、GLB 文件头和长度、嵌入贴图，以及网页引用的本地素材；随后检查三托货物守恒、卸货时停稳开门、阶段边界运动连续与回放重置。

## 动画范围

建筑 GLB 复用已有资产，网页加载时移除两辆静态车辆，在原位加入可开门货车、可升降货叉的叉车与三托货物。货物在车厢、叉车和暂存区之间转移，时间轴拖回任意位置都可恢复状态。动画设备由 Three.js 几何生成，未写入下载的建筑 GLB / Blender 源文件；完整动画由网页与 `app.mjs`、`simulation.mjs` 一起提供。

这是单车、单月台的作业示意。转向、速度、坡道与取货动作经过简化，没有车辆动力学、碰撞避让或多车调度。

## 可选：重新生成模型

现成模型由 Blender 5.2.2 LTS 生成。若要修改并重新生成，安装 Blender 后运行：

```sh
blender --background --factory-startup --python create-building.py
```

脚本会覆盖同目录的模型、材质图和渲染图。中文灯牌需要中文字体：Windows 会尝试微软雅黑 / 黑体，macOS 会尝试苹方，Linux 会尝试 Noto CJK。也可指定字体：

```sh
blender --background --factory-startup --python create-building.py -- --font /path/to/chinese-font.ttf
```

若没有中文字体，脚本使用英文装卸口标识。重新生成后如要更新文件校验值，运行 `node verify.mjs --update`。

## 复原范围

重点复原三排蓝色窗框、连续装卸口、编号灯牌、雨棚与支架、弧形墙面、立面标识、屋顶栏杆与天线。车辆为简化陪衬。背面、进深和尺寸来自推测，未还原室内与人物；这是用于网页展示的外观近似模型，不是测绘或施工模型。

第三方组件信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
