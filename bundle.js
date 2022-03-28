/**
 * 需要注意的是 /dist 文件夹一旦构建就说明已经创建了文件 再调用 node bundle.js 就会报错。
 */

const fs = require('fs');
const path = require('path')

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

// 查找路径下的文件并返回一个对象{路径，依赖，ast(5)}
const getModuleInfo = (file) => {
  const  body = fs.readFileSync(file, 'utf-8');
  
  // 获取到ast树 
  const ast = parser.parse(body,{
    sourceType: 'module'//指明使用的模块
  });

  // 收集依赖
  const deps = {};
  traverse(ast,{
    //ImportDeclaration方法代表的是对type类型为ImportDeclaration的节点的处理。
    ImportDeclaration({node}){
      const dirname = path.dirname(file);
      const abspath = './' + path.join(dirname, node.source.value);
      deps[node.source.value] = abspath;
      //const deps =  { './add.js': './src\\add.js', './minus.js': './src\\minus.js' }
    }
  })

  const {code} = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  })

  const moduleInfo = {file, deps, code} // 返回了该模块的路径，模块依赖，模块转换成es5的代码
  return moduleInfo;
}

// 迭代查找依赖
const parseModules = (file) =>{
  const entry = getModuleInfo(file);
  const temp = [entry];
  const depsGraph = {};
  for(let i = 0; i<temp.length;i++){
    const deps = temp[i].deps;
    if(deps){
      for(const key in deps) {
        if(deps.hasOwnProperty(key)){
          temp.push(getModuleInfo(deps[key]))// 开始迭代
        }
      }
    }
  }
   // 处理 temp
  temp.forEach(moduleInfo => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code:moduleInfo.code
    }
  })
  return depsGraph
}

const bundle = (file) =>{
  const depsGraph = JSON.stringify(parseModules(file));
  // 返回一个自执行函数 这个函数的目的在于定义 require函数 
  // 执行 require 函数的时候往里面传入了外层的变量 file 然后开始执行
  return `(function(graph) {
    function require(file){
      function absRequire(relpath){
        return require(graph[file].deps[relpath])
      }
      var exports = {};
      (function (require, exports, code){
        eval(code)
      })(absRequire, exports, graph[file].code)
      return exports;
    }
    require('${file}')
  })(${depsGraph})`
}
const content = bundle('./src/index.js')

fs.mkdirSync('./dist');
fs.writeFileSync('./dist/bundle.js', content);
