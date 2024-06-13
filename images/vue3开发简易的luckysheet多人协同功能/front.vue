<template>
  <!-- <button @click="save">提交</button> -->
  <div id="excelContent" :style="{ height: '700px' }"> </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
const filename = ref('test')
let currentSheet = ref(0)
let ws
const isWsChange = ref(false)
const wsChangeSheet = ref(null)

// 提交数据
function save() {
  let excelObj = window.luckysheet.getAllSheets()
  axios({
    url: 'http://127.0.0.1:3000/save',
    method: 'post',
    data: {
      excelData: excelObj,
      filename: filename.value
    }
  })
}

// 初始化
function initSocket() {
  ws = new WebSocket('ws://127.0.0.1:2000?f=' + filename.value)
  ws.onmessage = (message) => {
    const { row, col, after, sheet } = JSON.parse(message.data)
    const sheetData = window.luckysheet.getAllSheets()
    let idx
    isWsChange.value = true
    wsChangeSheet.value = sheet
    sheetData.find((item, index) => {
      if (item.index === sheet) {
        idx = index
        return true
      }
    })
    window.luckysheet.setCellValue(row, col, after, {
      isRefresh: true,
      order: idx
    })
  }
  ws.onclose = (err) => {
    console.log('关闭', err)
    ws.close()
    initSocket()
  }
}

// 对象数据对比
function equalObj(obj, otherObj) {
  try {
    const objKeys = Object.keys(obj)
    const otherObjKeys = Object.keys(otherObj)
    if (objKeys.length !== otherObjKeys.length) {
      return false
    }
    for (const i of objKeys) {
      const item = obj[i]
      const otherItem = otherObj[i]
      if ({}.toString.call(item) === '[object Object]') {
        const equalRes = equalObj(item, otherItem)
        if (!equalRes) {
          return false
        }
        continue
      }
      if ({}.toString.call(item) === '[object Array]') {
        for (let j in item) {
          const equalRes = equalObj(item[j], otherItem[j])
          if (!equalRes) {
            return false
          }
        }
        continue
      }
      if (item !== otherItem) {
        return false
      }
    }
    return true
  } catch (err) {
    console.log('errorMessage:', err)
    return false
  }
}

onMounted(() => {
  initSocket()
  window.luckysheet.create({
    lang: 'zh',
    title: "luckysheet多人系统",
    container: 'excelContent',
    gridKey: filename.value,
    showinfobar: false,
    loadUrl: 'http://127.0.0.1:3000/load',
    hook: {
      workbookCreateAfter(config) {
        console.log('工作薄初始化后', config)
        currentSheet.value = config.data[0].index
      },
      sheetActivate(sheetIndex) {
        console.log('当前工作表下标', sheetIndex)
        currentSheet.value = sheetIndex
      },
      cellUpdateBefore(row, col, data) {
        const sheetData = window.luckysheet.getAllSheets()
        const sheet = isWsChange.value ? wsChangeSheet.value : currentSheet.value
        const cellData = sheetData.filter((item) => item.index === sheet)[0]?.data[row][col]
        const isEqual = equalObj(data, cellData)
        if (isEqual) {
          console.log('已设置')
          return false
        }
        console.log('未设置')
      },
      cellUpdated(row, col, before, after) {
        console.log('更改后', after)
        // 给 ws 发送相关数据
        ws.send(JSON.stringify({
          row,
          col,
          sheet: currentSheet.value,
          after,
          filename: filename.value
        }))
      }
    }
  })

})
</script>

<style lang="scss" scoped></style>
