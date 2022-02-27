// Full spec-compliant TodoMVC with localStorage persistence
// and hash-based routing in ~150 lines.

// localStorage persistence
var STORAGE_KEY = 'todos-vuejs-2.0'
var todoStorage = {
  fetch: function () {
    var todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    todos.forEach(function (todo, index) {
      todo.id = index
    })
    todoStorage.uid = todos.length
    return todos
  },
  save: function (todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }
}

// visibility filters
var filters = {
  all: function (todos) {
    return todos
  },
  active: function (todos) {
    return todos.filter(function (todo) {
      return !todo.completed
    })
  },
  completed: function (todos) {
    return todos.filter(function (todo) {
      return todo.completed
    })
  }
}
Vue.component('text1', {
  data: function () {
    return {
      count: 10
    }
  },
  template: '士大  夫  ',
  activated() {
    console.log('2')
  }
})
Vue.component('button-counter1', {
  data: function () {
    return {
      count: 0,
      hidden: false
    }
  },
  template: '<button v-on:click="count++; hidden= true">You clicked me <span v-if="hidden"> sdf</span> {{ count }} times.</button>'
})
// app Vue instance
var app = new Vue({
  // app initial state
  data: {
    // todos: todoStorage.fetch(),
    // newTodo: '',
    // editedTodo: null,
    // visibility: 'all',
    // items: ['button-counter'],
    // visible: true,
    // key: 'button1'
    arr: [1, 2, 3],
    name: 'name'
  },
  mounted() {
    setTimeout(() => {
      // this.items = ['button-counter']
      this.visible = false
      this.key = 'button2'
    }, 3000)
    // setTimeout(() => {
    //   // this.items = ['button-counter']
    //   this.visible = true
    // }, 6000)

  },
  computed: {
    keyName() {
      return this.key + '156'
    }
  },
  // watch todos change for localStorage persistence
  watch: {
    key: {
      handler: function (todos) {
        //
      },
      deep: true
    }
  },

  // computed properties
  // https://vuejs.org/guide/computed.html
  // computed: {
  //   filteredTodos: function () {
  //     return filters[this.visibility](this.todos)
  //   },
  //   remaining: function () {
  //     return filters.active(this.todos).length
  //   },
  //   allDone: {
  //     get: function () {
  //       return this.remaining === 0
  //     },
  //     set: function (value) {
  //       this.todos.forEach(function (todo) {
  //         todo.completed = value
  //       })
  //     }
  //   }
  // },

  filters: {
    get(val) {
      return val.filter(item => item > 2)
    },
    classNameGet(val) {
      return 'other-name'
    }
  },

  // methods that implement data logic.
  // note there's no DOM manipulation here at all.
  methods: {
    addTodo: function () {
      var value = this.newTodo && this.newTodo.trim()
      if (!value) {
        return
      }
      this.todos.push({
        id: todoStorage.uid++,
        title: value,
        completed: false
      })
      this.newTodo = ''
    },

    removeTodo: function (todo) {
      this.todos.splice(this.todos.indexOf(todo), 1)
    },

    editTodo: function (todo) {
      this.beforeEditCache = todo.title
      this.editedTodo = todo
    },

    doneEdit: function (todo) {
      if (!this.editedTodo) {
        return
      }
      this.editedTodo = null
      todo.title = todo.title.trim()
      if (!todo.title) {
        this.removeTodo(todo)
      }
    },

    cancelEdit: function (todo) {
      this.editedTodo = null
      todo.title = this.beforeEditCache
    },

    removeCompleted: function () {
      this.todos = filters.active(this.todos)
    }
  },

  // a custom directive to wait for the DOM to be updated
  // before focusing on the input field.
  // https://vuejs.org/guide/custom-directive.html
  directives: {
    'todo-focus': function (el, binding) {
      if (binding.value) {
        el.focus()
      }
    }
  }
})

// handle routing
function onHashChange() {
  var visibility = window.location.hash.replace(/#\/?/, '')
  if (filters[visibility]) {
    app.visibility = visibility
  } else {
    window.location.hash = ''
    app.visibility = 'all'
  }
}

window.addEventListener('hashchange', onHashChange)
onHashChange()

let el = document.getElementById('todoapp')
// mount
app.$mount(el)
