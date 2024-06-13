const Koa = require("koa");
const Router = require("koa-router");
const cors = require("koa-cors");
const { koaBody } = require("koa-body");
const WebSocket = require("ws");
const qs = require("qs");
const fs = require("fs");
const path = require("path");

const app = new Koa();
var router = new Router();
app.use(koaBody());
app.use(cors());
app.use(router.routes()).use(router.allowedMethods());

// ws 服务开在 2000 端口
const server = new WebSocket.Server({ port: 2000 });
// 连接池 - 存储所有连接上的用户
let sockets = [];

server.on("connection", (socket, req) => {
  // 从 ? 号分割
  const [, queryStr] = req.url.split("?");
  // 把地址上携带的参数解析出来
  const query = qs.parse(queryStr);

  // 每次有用户连接上，就把用户添加进连接池
  sockets.push({
    socket,
    filename: query.f,
  });

  // 到时候用户修改了单元格就会给 websocket 服务发一条信息，触发 message 监听
  socket.on("message", (message) => {
    const data = JSON.parse(message.toString());
    // 提取数据
    const { row, col, sheet, after, filename } = data;
    // 取出要修改的文件
    const filePath = path.join(__dirname, "/" + filename + ".json");
    const fileContent = JSON.parse(fs.readFileSync(filePath));

    // 根据 index 属性查找要修改的工作表
    const sheetArr = fileContent.filter(item => item.index === sheet)[0];
    // console.log("接收的信息", row, col, sheet, after, filename);
    console.log("接收到信息");
    if (!sheetArr) {
      return
    }
    // 更新要修改的单元格数据
    sheetArr.data[row][col] = after;

    // 删除原文件
    fs.unlinkSync(filePath);
    // 重新将新数据写入源文件
    fs.writeFileSync(filePath, JSON.stringify(fileContent));
    // 通知所有在编辑这个表格的用户更新数据
    sockets.forEach((user) => {
      if (user.filename === filename) {
        user.socket.send(message.toString());
      }
    });
  });
  socket.on("close", (code, reason) => {
    console.log("关闭中");
    sockets = sockets.filter((s) => s.socket !== socket);
  });
});

// 获取文件
router.post("/load", async (ctx) => {
  // 获取文件名
  const { gridKey: filename } = ctx.request.body;
  // 拼接文件路径
  const _path = path.join(__dirname, "/" + filename + ".json");
  let _isExist = fs.existsSync(_path);

  // 判断文件是否存在，不存在则创建
  if (_isExist) {
    // 存在则读取数据并返回给前端
    const data = fs.readFileSync(_path);
    ctx.body = data;
  } else {
    // 使用默认模版
    let demoPath = path.join(__dirname, "./demo.json");
    let data = fs.readFileSync(demoPath);
    // 把空模版吸入文件，等同于新建文件
    fs.writeFileSync(path.join(__dirname, "/" + filename + ".json"), data);
    ctx.body = data;
  }
});

// 保存
router.post("/save", async (ctx, next) => {
  const { excelData, filename } = ctx.request.body;
  const filePath = path.join(__dirname, "/" + filename + ".json");
  saveFileContent(filePath, JSON.stringify(excelData));
  ctx.body = "ok";
});

// 设置数据到文件内
function saveFileContent(path, content) {
  fs.writeFileSync(path, content);
}

app.listen(3000);
