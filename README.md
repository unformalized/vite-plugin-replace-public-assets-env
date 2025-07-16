
在使用 micro-app 微前端框架时，接入 vite 项目的子应用时，会将入口 HTML 中所有的 modulepreload link 标签全部去除，造成一些模块无法立即加载，使用该插件会插入一条 script 标签手动并行加载所有原有 modulepreload 标签的资源
