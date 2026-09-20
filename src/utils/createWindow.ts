import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'

const appWindow = getCurrentWindow()

type WindowConfig = {
  label?: string
  title?: string
  url?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  x?: number
  y?: number
  center?: boolean
  resizable?: boolean
  maximized?: boolean
  decorations?: boolean
  alwaysOnTop?: boolean
  dragDropEnabled?: boolean
  visible?: boolean
  transparent?: boolean
  shadow?: boolean
  skipTaskbar?: boolean
}

const windowConfig: WindowConfig = {
  label: undefined, // 窗口唯一label
  title: '', // 窗口标题
  url: '', // 路由地址url
  width: 1000, // 窗口宽度
  height: 640, // 窗口高度
  minWidth: undefined, // 窗口最小宽度
  minHeight: undefined, // 窗口最小高度
  x: undefined, // 窗口相对于屏幕左侧坐标
  y: undefined, // 窗口相对于屏幕顶端坐标
  center: true, // 窗口居中显示
  resizable: true, // 是否支持缩放
  maximized: false, // 最大化窗口
  decorations: false, // 窗口是否装饰边框及导航条
  alwaysOnTop: false, // 置顶窗口
  dragDropEnabled: false, // 禁止系统拖放
  visible: true, // 默认显示窗口
  transparent: false, // 是否开启窗口透明
  shadow: false // 是否开启窗口阴影
}

class Windows {
  mainWin: WebviewWindow | null

  constructor() {
    // 主窗口
    this.mainWin = null
  }

  // 创建新窗口
  async createWin(
    options: Partial<WindowConfig> = {}
  ): Promise<WebviewWindow | null> {
    console.log('-=-=-=-=-=开始创建窗口')

    const args: WindowConfig = {
      ...windowConfig,
      ...options,
      visible: options.visible ?? true
    }
    if (!args.label) {
      args.label = `win-${Date.now()}`
    }

    // 判断窗口是否存在
    const existWin = await this.getWin(args.label)
    if (existWin) {
      console.log('窗口已存在>>', existWin)
      try {
        await existWin.show()
        await existWin.unminimize()
        await existWin.setFocus()
      } catch (error) {
        console.log('恢复已存在窗口失败', error)
      }
      return existWin
    }

    // 创建窗口对象
    const win = new WebviewWindow(args.label, args)

    // 窗口创建完毕/失败
    win.once('tauri://created', async () => {
      console.log('tauri://created')

      if (args.visible !== false) {
        await win.show()
        await win.setFocus()
      }

      // 是否主窗口
      if (args.label?.indexOf('main') !== -1) {
        // ...
      }

      // 是否最大化
      if (args.maximized && args.resizable) {
        console.log('is-maximized')
        await win.maximize()
      }
    })

    win.once('tauri://error', async (error) => {
      console.log('window create error!', error)
    })

    return win
  }

  // 获取窗口
  async getWin(label: string): Promise<WebviewWindow | null> {
    return await WebviewWindow.getByLabel(label)
  }

  // 获取全部窗口
  async getAllWin(): Promise<WebviewWindow[]> {
    return await WebviewWindow.getAll()
  }

  // 开启主进程监听事件
  async listen(): Promise<void> {
    console.log('——+——+——+——+——+开始监听窗口')
    // 创建新窗体
    await listen('win-create', (event) => {
      const payload = (event.payload ?? {}) as Partial<WindowConfig>
      this.createWin(payload)
    })

    // 显示窗体
    await listen('win-show', async () => {
      if (appWindow.label.indexOf('main') == -1) return
      await appWindow.show()
      await appWindow.unminimize()
      await appWindow.setFocus()
    })

    // 隐藏窗体
    await listen('win-hide', async () => {
      if (appWindow.label.indexOf('main') == -1) return
      await appWindow.hide()
    })

    // 关闭窗体
    await listen('win-close', async () => {
      await appWindow.close()
    })

    // ...
  }
}

export default new Windows()
