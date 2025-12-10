// 使用类型断言处理 window.render
function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).render) {
      resolve()
    } else {
      const checkRender = () => {
        if ((window as any).render) {
          resolve()
        } else {
          setTimeout(checkRender, 100)
        }
      }
      checkRender()
    }
  })
}

async function initSandbox() {
  await waitForRender()

  window.parent.postMessage(
    {
      type: 'SANDBOX_READY',
    },
    '*'
  )

  window.addEventListener('message', async (event) => {
    const { type, messageId, latex } = event.data

    if (type === 'PARSE_LATEX' && latex) {
      try {
        const renderedResult = (window as any).render(latex, {
          htmlTags: true, // 改为true以支持HTML标签
          typographer: false, // 默认为true，如果为true，会把(c)转换为©
          width: 800, // 设置渲染宽度（默认是1200，调小会让公式更紧凑）
          breaks: true, // 支持换行
          scale: 1, // 整体缩放比例（1.0是原始大小）
          outMath: {
            include_svg: false, // 禁用SVG输出
            include_mathml: true, // 只启用MathML输出
            include_asciimath: false, // 禁用ASCII Math
            include_latex: true, // 禁用LaTeX
          }
        })

        window.parent.postMessage(
          {
            type: 'PARSE_RESULT',
            messageId,
            result: {
              success: true,
              data: renderedResult,
            },
          },
          '*'
        )
      } catch (error) {
        window.parent.postMessage(
          {
            type: 'PARSE_RESULT',
            messageId,
            result: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          '*'
        )
      }
    }
  })
}

initSandbox().catch(console.error)
