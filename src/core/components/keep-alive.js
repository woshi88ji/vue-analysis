/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'
import { CLIEngine } from 'eslint';

type VNodeCache = { [key: string]: ?VNode };

// 获取组件名称
function getComponentName(opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}
// 匹配名称，支持 数组，字符串和正则
function matches(pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
// 工具函数，清除修改后不在includes和excludes中的key
function pruneCache(keepAliveInstance: any, filter: Function) {
  // keepAliveInstance 组件实例
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}
// 清除缓存实例
function pruneCacheEntry(
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]



  // 不理解这块
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }


  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  // 声明构建一个抽象组件
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created() {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed() {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted() {
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render() {
    // 获取组件的插槽内容
    const slot = this.$slots.default
    // 获取其中第一个组件，如果没有或者是原生元素则为空
    const vnode: VNode = getFirstComponentChild(slot)
    // 判断子组件是否存在
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 获取组件名称
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // 如果满足not included 或者 excluded ,直接返回包含组件
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      // 如果组件上存在 key，则用组件的key作为 组件的唯一标识， 如果没有，则用 cid 和tag拼接作为标识
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      // componentInstance属性里面存放的是组件的实例。
      // 如果缓存cache中已有该key，说明该组件实例已经缓存过，将保存起来的实例属性赋值给vnode，最后渲染出来
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 清除之前保留的实例，再将实例保存进来，便于在设置max超出时，将最前面的实例清除
        remove(keys, key)
        keys.push(key)
      } else {
        // 
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        // 如果keep-alive组件设置了max属性， 并且 缓存的keys的长度大于max，会将最先存入的实例清除掉
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }

      vnode.data.keepAlive = true
    }
    // 返回包含的组件，如果为空则返回插槽内容
    return vnode || (slot && slot[0])
  }
}
