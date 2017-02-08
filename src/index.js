const React = require('react')
const { PropTypes, Component, createElement: h, Children } = React

/**
 * https://github.com/hapijs/nes/blob/master/API.md#client
 */
const clientShape = PropTypes.shape({
  onError: PropTypes.func,
  onConnect: PropTypes.func,
  onDisconnect: PropTypes.func,
  onUpdate: PropTypes.func,
  connect: PropTypes.func.isRequired,
  disconnect: PropTypes.func,
  id: PropTypes.string,
  request: PropTypes.func.isRequired,
  message: PropTypes.func.isRequired,
  subscribe: PropTypes.func.isRequired,
  unsubscribe: PropTypes.func.isRequired,
  subscriptions: PropTypes.func.isRequired,
  overrideReconnectionAuth: PropTypes.func
})

/**
 * https://github.com/hapijs/nes/blob/master/API.md#new-clienturl-options
 */
class ClientProvider extends Component {

  constructor (props, context) {
    super(props, context)

    this.client = props.client
    const clientCallbacks = ['onError', 'onConnect', 'onDisconnect', 'onUpdate']
    clientCallbacks.forEach((cbName) => {
      if (props[cbName]) {
        this.client[cbName] = props[cbName]
      }
    })
  }

  getChildContext () {
    return { client: this.client }
  }

  render () {
    return Children.only(this.props.children)
  }
}

ClientProvider.DisplayName = 'NesClientProvider'

ClientProvider.propTypes = {
  client: clientShape.isRequired,
  onError: PropTypes.func,
  onConnect: PropTypes.func,
  onDisconnect: PropTypes.func,
  onUpdate: PropTypes.func,
  children: PropTypes.element.isRequired
}

ClientProvider.childContextTypes = { client: clientShape.isRequired }

exports.ClientProvider = ClientProvider

/**
 * export default withNesClient(MyComponent)
 * MyComponent will now have `client` as prop
 */
exports.withNesClient = function withNesClient (WrappedComponent) {
  class WithNesClient extends Component {
    render () {
      return h(
        WrappedComponent,
        Object.assign({ client: this.context.client }, this.props)
      )
    }
  }

  WithNesClient.contextTypes = { client: clientShape }

  return WithNesClient
}

/**
 * ConnectNes
 * https://github.com/hapijs/nes/blob/master/API.md#clientconnectoptions-callback
 */
class Connect extends Component {
  constructor (props, context) {
    super(props, context)
    this.state = {
      connecting: false,
      connected: !!context.client.id,
      error: undefined
    }
    this.handleConnectionResponse = this.handleConnectionResponse.bind(this)
    this.connect = this.connect.bind(this)
    // this.handleDisconnect = this.handleDisconnect.bind(this)
  }

  componentDidMount () {
    this.connect()
  }

  render () {
    if (!this.props.children) {
      return null
    }

    return this.props.children({
      connecting: this.state.connecting,
      connected: this.state.connected,
      error: this.state.error,
      overrideReconnectionAuth: this.context.client.overrideReconnectionAuth,
      connect: this.connect,
      disconnect: this.context.client.disconnect.bind(this.context.client)
    })
  }

  handleConnectionResponse (err) {
    this.setState({ connecting: false, connected: !err, error: err }, () => {
      if (this.props.onConnect) {
        this.props.onConnect(err)
      }
    })
  }

  // This has to be wired up through the ClientProvider via context somehow
  // handleDisconnect () {
  //   this.setState({ connected: false }, () => {
  //     if (this.props.onDisconnect) {
  //       this.props.onDisconnect()
  //     }
  //   })
  // }

  connect () {
    const { auth, delay, maxDelay, retries, timeout } = this.props
    this.setState({ connecting: true })
    this.context.client.connect(
      { auth, delay, maxDelay, retries, timeout },
      this.handleConnectionResponse
    )
  }
}

Connect.contextTypes = { client: clientShape }

Connect.propTypes = {
  auth: PropTypes.oneOf([ PropTypes.object, PropTypes.string ]),
  delay: PropTypes.number,
  maxDelay: PropTypes.number,
  retries: PropTypes.number,
  timeout: PropTypes.number,
  onConnect: PropTypes.func
  // onDisconnect: PropTypes.func
}

exports.Connect = Connect

/**
 * https://github.com/hapijs/nes/blob/master/API.md#clientrequestoptions-callback
 */
class Request extends Component {
  constructor (props, context) {
    super(props, context)
    this.state = {
      fetching: false,
      payload: undefined,
      error: undefined,
      statusCode: undefined,
      headers: undefined
    }
    this.handleResponse = this.handleResponse.bind(this)
    this.request = this.request.bind(this)
  }

  componentDidMount () {
    if (!this.props.lazy) this.request()
  }

  componentDidUpdate (prevProps, prevState) {
    const diffProps = [ 'path', 'method' ]
    if (
      !this.props.lazy && diffProps.some(k => this.props[k] !== prevProps[k])
    ) {
      this.request()
    }
  }

  render () {
    if (!this.props.children) {
      return null
    }

    return this.props.children({
      fetching: this.state.fetching,
      payload: this.state.payload,
      error: this.state.error,
      statusCode: this.state.statusCode,
      headers: this.state.headers,
      request: this.request
    })
  }

  handleResponse (err, payload, statusCode, headers) {
    this.setState(
      { fetching: false, payload, error: err, statusCode, headers },
      () => {
        this.props.onResponse(err, payload, statusCode, headers)
      }
    )
  }

  request () {
    const { client } = this.context
    const { path, method, headers, payload } = this.props
    this.setState({ fetching: true })
    client.request({ path, method, headers, payload }, this.handleResponse)
  }
}

Request.contextTypes = { client: clientShape }

Request.defaultProps = {
  method: 'GET',
  lazy: false,
  onResponse: () => {}
}

Request.propTypes = {
  lazy: PropTypes.bool,
  path: PropTypes.string,
  method: PropTypes.string,
  headers: PropTypes.object,
  payload: PropTypes.object,
  onResponse: PropTypes.func
}

exports.Request = Request

/**
 * https://github.com/hapijs/nes/blob/master/API.md#clientsubscribepath-handler-callback
 */
class Subscribe extends Component {
  constructor (props, context) {
    super(props, context)
    this.state = { subscribing: false, subscribed: false, error: undefined }

    this.handleSubscribe = this.handleSubscribe.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.unsubscribe = this.unsubscribe.bind(this)
  }

  componentDidMount () {
    if (!this.props.lazy) {
      this.subscribe()
    }
  }

  componentDidUpdate (prevProps, prevState) {
    const diffProps = [ 'path', 'handler' ]
    if (
      !this.props.lazy && diffProps.some(k => this.props[k] !== prevProps[k])
    ) {
      const { client } = this.context
      const { path, handler } = this.props
      client.unsubscribe(path, handler, () => {
        this.subscribe()
      })
    }
  }

  componentWillUnmount () {
    const { client } = this.context
    const { path, handler } = this.props
    client.unsubscribe(path, handler, () => {})
  }

  render () {
    if (!this.props.children) {
      return null
    }

    return this.props.children({
      subscribing: this.state.subscribing,
      subscribed: this.state.subscribed,
      error: this.state.error,
      getSubscriptions: this.context.client.subscriptions,
      subscribe: this.subscribe,
      unsubscribe: this.unsubscribe
    })
  }

  handleSubscribe (err) {
    this.setState({ subscribing: false, subscribed: !err, error: err }, () => {
      this.props.onSubscribe(err)
    })
  }

  subscribe () {
    this.setState({ subscribing: true })
    this.context.client.subscribe(
      this.props.path,
      this.props.handler,
      this.handleSubscribe
    )
  }

  unsubscribe () {
    const { client } = this.context
    const { path, handler } = this.props
    client.unsubscribe(path, handler, err => {
      this.setState({ subscribed: !err, error: err }, () => {
        this.props.onUnsubscribe(err)
      })
    })
  }
}

Subscribe.contextTypes = { client: clientShape }
Subscribe.propTypes = {
  path: PropTypes.string,
  handler: PropTypes.func,
  onSubscribe: PropTypes.func,
  onUnsubscribe: PropTypes.func
}
Subscribe.defaultProps = {
  onSubscribe: () => {},
  onUnsubscribe: () => {}
}

exports.Subscribe = Subscribe
