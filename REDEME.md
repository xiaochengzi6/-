>注意：如果已经生成了`./dist/bundle.js`就不需要执行 `Node bundle.js`文件。
>初次运行 node bundle.js 然后代开 index.html 可以查看
## 实现原理
1.需要读到入口文件里面的内容。

2.分析入口文件，递归的去读取模块所依赖的文件内容，生成AST语法树。

3.根据AST语法树，生成浏览器能够运行的代码

打印 `ast.program.body` 树发现 
~~~js
[
  Node {
    type: 'ImportDeclaration',
    start: 0,
    end: 26,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    specifiers: [ [Node] ],
    source: Node {
      type: 'StringLiteral',
      start: 16,
      end: 26,
      loc: [SourceLocation],
      extra: [Object],
      value: './add.js'
    }
  },
  Node {
    type: 'ImportDeclaration',
    start: 28,
    end: 61,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    specifiers: [ [Node] ],
    source: Node {
      type: 'StringLiteral',
      start: 48,
      end: 60,
      loc: [SourceLocation],
      extra: [Object],
      value: './minus.js'
    }
  },
  Node {
    type: 'VariableDeclaration',
    start: 65,
    end: 86,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    declarations: [ [Node] ],
    kind: 'const'
  },
  Node {
    type: 'VariableDeclaration',
    start: 88,
    end: 116,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    declarations: [ [Node] ],
    kind: 'const'
  },
  Node {
    type: 'ExpressionStatement',
    start: 120,
    end: 137,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    expression: Node {
      type: 'CallExpression',
      start: 120,
      end: 136,
      loc: [SourceLocation],
      callee: [Node],
      arguments: [Array]
    }
  },
  Node {
    type: 'ExpressionStatement',
    start: 139,
    end: 161,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    expression: Node {
      type: 'CallExpression',
      start: 139,
      end: 160,
      loc: [SourceLocation],
      callee: [Node],
      arguments: [Array]
    }
  }
]
~~~
简单的看很有规律是由 `[]` 数组来组合的似乎每一个都被换分成
~~~js
  Node {
    type: 'ImportDeclaration',// 这里可以看成类型
    start: 28,
    end: 61,
    loc: SourceLocation {
      start: [Position],
      end: [Position],
      filename: undefined,
      identifierName: undefined
    },
    specifiers: [ [Node] ],
    source: Node {
      type: 'StringLiteral',
      start: 48,
      end: 60,
      loc: [SourceLocation],
      extra: [Object],
      value: './minus.js' // 这里的value指的就是import的值
    }
  },
~~~
我们就利用这样的特性来获取文件名 `{ './add.js': './src\\add.js', './minus.js': './src\\minus.js' }`

再将Es6转化成 Es5



~~~js
 (function (graph) {
        function require(file) {
            (function (code) {
                eval(code)
            })(graph[file].code)
        }
        require(file) // 这里 file 指向的是外层函数的参数 file
    })(depsGraph)
~~~
刚开始执行`eval(code)`的时候就是在运行这个代码
~~~js
// index.js
"use strict"
var _add = _interopRequireDefault(require("./add.js"));
var _minus = require("./minus.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var sum = (0, _add["default"])(1, 2);
var division = (0, _minus.minus)(2, 1);
console.log(sum); console.log(division);
~~~
但是这里是在 depsGraph 这个对象中运行的 我们来看一下这个对象
~~~js
{
  './src/index.js': {
    deps: { './add.js': './src\\add.js', './minus.js': './src\\minus.js' },
    code: '"use strict";\n' +
      '\n' +
      'var _add = _interopRequireDefault(require("./add.js"));\n' +
      '\n' +
      'var _minus = require("./minus.js");\n' +
      '\n' +
      'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 
"default": obj }; }\n' +
      '\n' +
      'var sum = (0, _add["default"])(1, 2);\n' +
      'var division = (0, _minus.minus)(2, 1);\n' +
      'console.log(sum);\n' +
      'console.log(division);'
  },
  './src\\add.js': {
    deps: {},
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports["default"] = void 0;\n' +
      '\n' +
      'var _default = function _default(a, b) {\n' +
      '  return a + b;\n' +
      '};\n' +
      '\n' +
      'exports["default"] = _default;'
  },
  './src\\minus.js': {
    deps: {},
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports.minus = void 0;\n' +
      '\n' +
      'var minus = function minus(a, b) {\n' +
      '  return a - b;\n' +
      '};\n' +
      '\n' +
      'exports.minus = minus;'
  }
}
~~~
很明显里面只有以绝对路径命名的参数 例如这些`require("./add.js")`都不会得到这个对象中的code 我们要对其转化成一个绝对路径

~~~js
(function (graph) {
    function require(file) {
        function absRequire(relPath) {
          // 实际上调用 require('./add.js')就是在调用 './src/index.js'中的deps的值
            return require(graph[file].deps[relPath])
        }
        (function (require,code) {
            eval(code)
        })(absRequire,graph[file].code)
    }
    require(file)
})(depsGraph)
~~~
怎么来理解 `require(graph[file].deps[relPath]) `实际上调用 require('./add.js')就是在调用` './src/index.js'` 中的deps的值
~~~js
depsGraph: {
  './src/index.js': {
    deps: { './add.js': './src\\add.js', './minus.js': './src\\minus.js' },
    // ...
  },
  //...
}
~~~
就是加了一层嵌套。目的还是从主文件下的依赖关系 `deps` 中拿到绝对路径。


但是 export 也没有定义 在执行 add.js 文件的时候会出现问题
~~~js
// add.js
"use strict";
Object.defineProperty(exports, "__esModule", {  value: true});
exports["default"] = void 0;
var _default = function _default(a, b) {  return a + b;};
exports["default"] = _default;
~~~

所以我们创建一个 `export = {}` 然后再通过 `require` 函数 `return` 出去这样包裹着的对象。
使用 `_interopRequireDefault` 会接收到我们的 `exports default function () {....}` 的值。

~~~js
// index.js
"use strict"
var _add = _interopRequireDefault(require("./add.js"));
var _minus = require("./minus.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
~~~
清晰了然 _interopRequireDefault 查看对象是否有 esModule (ECM格式)对象。如果有就会直接返回 obj 反之则返回一个对象且属性名为 `default` 的属性。

~~~js
'./src\\add.js': {
    deps: {},
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports["default"] = void 0;\n' +
      '\n' +
      'var _default = function _default(a, b) {\n' +
      '  return a + b;\n' +
      '};\n' +
      '\n' +
      'exports["default"] = _default;'
  }
~~~
我们可以明白 这些 `add.js` 又或者是 `minu.js` 的这类文件都会将 `__esModule` 这样的属性存在来证明是使用了 `ESM 格式` 
~~~js
Object.defineProperty(exports, "__esModule", {
  value: true
})
~~~
