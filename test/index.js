/* eslint-env mocha */
const Hapi = require('hapi')
const Nes = require('nes')
const React = require('react')
const expect = require('expect')
const TestUtils = require('react-addons-test-utils')
const ReactNes = require('../src/index')

const { PropTypes, Component, createElement: h } = React
const { ClientProvider, withNesClient, Connect, Subscribe, Request } = ReactNes

describe('react-nes', () => {
  class Child extends Component {
    render () {
      return h('div')
    }
  }

  Child.contextTypes = { client: PropTypes.object.isRequired }

  const mockClient = {
    onError: () => {},
    onConnect: () => {},
    onDisconnect: () => {},
    onUpdate: () => {},
    connect: () => {},
    disconnect: () => {},
    id: '1',
    request: () => {},
    message: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    subscriptions: () => {},
    overrideReconnectionAuth: () => {}
  }

  describe('ClientProvider', () => {
    const client = mockClient

    it('enforces single child', (done) => {
      expect(() => TestUtils.renderIntoDocument(
        h(ClientProvider, { client }, h(Child))
      )).toNotThrow()

      try {
        expect(() => TestUtils.renderIntoDocument(
          h(ClientProvider, { client }, h(Child))
        )).toThrow(/a single React element child/)

        expect(() => TestUtils.renderIntoDocument(
          h(ClientProvider, { client }, h(Child), h(Child))
        )).toThrow(/a single React element child/)
      } finally {
        done()
      }
    })

    it('should add the client to the childs context', () => {
      const tree = TestUtils.renderIntoDocument(
        h(ClientProvider, { client }, h(Child))
      )

      const child = TestUtils.findRenderedComponentWithType(tree, Child)
      expect(child.context.client).toBe(client)
    })
  })

  describe('withNesClient', () => {
    const client = mockClient
    const WithClient = withNesClient(Child)

    it('should have client as a prop', () => {
      const tree = TestUtils.renderIntoDocument(
        h(ClientProvider, { client },
          h('div', null, h(WithClient))
        )
      )

      const child = TestUtils.findRenderedComponentWithType(tree, Child)
      expect(child.props.client).toBe(client)
    })
  })

  describe('Connect', () => {
    it('can render with no children', () => {
      TestUtils.renderIntoDocument(
        h(
          ClientProvider,
          {
            client: mockClient
          },
          h(Connect, {
            onConnect: (err) => {
              expect(err).toNotExist()
            }
          })
        )
      )
    })

    it('connects the client', (done) => {
      const server = new Hapi.Server()
      server.connection()
      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.info.port)

          let runCount = 0
          const renderCb = ({ connecting, connected, error }) => {
            expect(connecting).toBe(runCount === 1)
            expect(connected).toBe(runCount === 2)
            expect(error).toBeFalsy()
            ++runCount
            return h(Child)
          }

          TestUtils.renderIntoDocument(
            h(
              ClientProvider,
              {
                client,
                onConnect: (err) => {
                  expect(err).toNotExist()
                },
                onDisconnect: () => {}
              },
              h(Connect, {
                onConnect: (err) => {
                  expect(err).toNotExist()
                  client.disconnect()
                  server.stop(done)
                }
              }, renderCb)
            )
          )
        })
      })
    })
  })

  describe('Subscribe', () => {
    it('can render with no children', () => {
      TestUtils.renderIntoDocument(
        h(
          ClientProvider,
          {
            client: mockClient
          },
          h(Subscribe, {
            path: '/',
            handler: () => {},
            lazy: true
          })
        )
      )
    })

    it('subscribes', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.subscription('/')

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)

          const connectRenderCb = ({ connecting, connected, error }) => {
            if (!connected) return null

            return h(
              Subscribe,
              {
                path: '/',
                handler: (message) => {
                  expect(message).toBe('hey')
                  client.disconnect()
                  server.stop(done)
                },
                onSubscribe: (err) => {
                  expect(err).toNotExist()
                  server.publish('/', 'hey')
                }
              }
            )
          }

          TestUtils.renderIntoDocument(
            h(ClientProvider, { client },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })

    it('subscribes on demand (lazy)', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.subscription('/')
        server.subscription('/1')

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)
          let runCount = 0
          let didUnsubscribe = false
          class Parent extends Component {
            constructor (props) {
              super(props)
              this.state = { path: '/', subscribed: false }
            }

            componentDidMount () {
              setTimeout(() => {
                this.setState({ path: '/1' })
              }, 50)
            }

            render () {
              if (!this.props.connected) return null

              return h(
                Subscribe,
                {
                  path: this.state.path,
                  handler: (message) => {
                    if (message === '/') {
                      expect(message).toBe('/')
                    } else {
                      expect(message).toBe('/1')
                      this.setState({ subscribed: true })
                    }
                  },
                  onSubscribe: (err) => {
                    expect(err).toNotExist()
                    server.publish(this.state.path, this.state.path)
                  },
                  onUnsubscribe: (err) => {
                    expect(err).toNotExist()
                    client.disconnect()
                    server.stop(done)
                  }
                },
                ({ subscribed, subscribe, unsubscribe }) => {
                  if (runCount === 0) {
                    setTimeout(subscribe)
                  }

                  if (this.state.subscribed && !didUnsubscribe) {
                    didUnsubscribe = true
                    setTimeout(unsubscribe)
                  }

                  runCount++
                  return h(Child)
                }
              )
            }
          }

          const connectRenderCb = ({ connecting, connected, error }) => {
            return h(Parent, { connected })
          }

          TestUtils.renderIntoDocument(
            h(ClientProvider, { client },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })

    it('unsubscribes on unmount', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.subscription('/')

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)

          class Parent extends Component {
            constructor (props) {
              super(props)
              this.state = { path: '/', subscribed: false }
            }

            componentDidUpdate (prevProps, prevState) {
              if (prevState.path === '/' && this.state.path === '/1') {
                setTimeout(() => {
                  this.props.disconnect()
                })
              }
            }

            render () {
              if (!this.props.connected || this.state.path === '/1') return null

              return h(
                Subscribe,
                {
                  path: this.state.path,
                  onSubscribe: (err) => {
                    expect(err).toNotExist()
                    this.setState({ path: '/1' })
                  }
                },
                () => {
                  return h(Child)
                }
              )
            }
          }

          const connectRenderCb = ({ connecting, connected, error, disconnect }) => {
            return h(Parent, { connected, disconnect })
          }

          TestUtils.renderIntoDocument(
            h(
              ClientProvider,
              {
                client,
                onDisconnect: (willReconnect, log) => {
                  expect(willReconnect).toBe(false)
                  expect(log).toBeA('object')
                  expect(client.subscriptions()).toEqual([])
                  client.disconnect()
                  server.stop(done)
                }
              },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })
  })

  describe('Request', () => {
    it('can render with no children', () => {
      TestUtils.renderIntoDocument(
        h(
          ClientProvider,
          {
            client: mockClient
          },
          h(Request, {
            path: '/',
            lazy: true
          })
        )
      )
    })

    it('makes request on mount', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.route({
          method: 'GET',
          path: '/',
          handler: (request, reply) => reply('hello')
        })

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)
          let runCount = 0

          const connectRenderCb = ({ connecting, connected, error }) => {
            if (!connected) return null

            return h(
              Request,
              {
                lazy: false,
                path: '/',
                method: 'GET',
                onResponse: (err, payload, statusCode, headers) => {
                  expect(err).toNotExist()
                  expect(payload).toBe('hello')
                  expect(statusCode).toBe(200)
                  expect(headers).toNotExist()
                  client.disconnect()
                  server.stop(done)
                }
              },
              ({
                fetching,
                payload,
                error,
                statusCode,
                headers,
                request
              }) => {
                expect(error).toNotExist()
                expect(request).toBeA('function')
                expect(fetching).toBe(runCount === 1)

                if (payload) {
                  expect(runCount).toBe(2)
                  expect(payload).toBe('hello')
                  expect(statusCode).toBe(200)
                }
                ++runCount
                return h(Child)
              }
            )
          }

          TestUtils.renderIntoDocument(
            h(ClientProvider, { client },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })

    it('makes request on on demand (lazy)', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.route({
          method: 'GET',
          path: '/',
          handler: (request, reply) => reply('hello')
        })

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)
          let runCount = 0

          const connectRenderCb = ({ connecting, connected, error }) => {
            if (!connected) return null

            return h(
              Request,
              {
                lazy: true,
                path: '/',
                method: 'GET',
                onResponse: (err, payload, statusCode, headers) => {
                  expect(err).toNotExist()
                  expect(payload).toBe('hello')
                  expect(statusCode).toBe(200)
                  expect(headers).toNotExist()
                  client.disconnect()
                  server.stop(done)
                }
              },
              ({
                fetching,
                payload,
                error,
                statusCode,
                headers,
                request
              }) => {
                expect(error).toNotExist()
                expect(request).toBeA('function')
                expect(fetching).toBe(runCount === 1)

                if (payload) {
                  expect(runCount).toBe(2)
                  expect(payload).toBe('hello')
                  expect(statusCode).toBe(200)
                }

                if (runCount === 0) {
                  setTimeout(() => {
                    request()
                  })
                }
                ++runCount
                return h(Child)
              }
            )
          }

          TestUtils.renderIntoDocument(
            h(ClientProvider, { client },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })

    it('makes new request when props change', (done) => {
      const server = new Hapi.Server()
      server.connection()

      server.register({ register: Nes, options: { auth: false } }, (err) => {
        expect(err).toNotExist()
        expect(server).toExist()

        server.route({
          method: 'GET',
          path: '/',
          handler: (request, reply) => reply('hello')
        })

        server.route({
          method: 'GET',
          path: '/1',
          handler: (request, reply) => reply('goodbye')
        })

        server.start((err) => {
          expect(err).toNotExist()

          const client = new Nes.Client('http://localhost:' + server.connections[0].info.port)

          class Parent extends Component {
            constructor (props) {
              super(props)
              this.state = { path: '/' }
            }

            componentDidMount () {
              setTimeout(() => {
                this.setState({ path: '/1' })
              }, 10)
            }

            render () {
              if (!this.props.connected) {
                return null
              }

              return h(
                Request,
                {
                  lazy: false,
                  path: this.state.path,
                  method: 'GET',
                  onResponse: (err, payload, statusCode, headers) => {
                    expect(err).toNotExist()
                    expect(statusCode).toBe(200)

                    if (payload === 'goodbye') {
                      client.disconnect()
                      server.stop(done)
                    }
                  }
                },
                ({
                  fetching,
                  payload,
                  error,
                  statusCode,
                  headers,
                  request
                }) => {
                  expect(error).toNotExist()
                  expect(request).toBeA('function')
                  expect(fetching).toBe(runCount === 1 || runCount === 4)

                  if (runCount === 2) {
                    expect(payload).toBe('hello')
                    expect(statusCode).toBe(200)
                  }

                  if (runCount === 5) {
                    expect(payload).toBe('goodbye')
                    expect(statusCode).toBe(200)
                  }

                  ++runCount
                  return h(Child)
                }
              )
            }
          }

          let runCount = 0

          const connectRenderCb = ({ connecting, connected, error }) => {
            if (!connected) return null

            return h(Parent, { connected })
          }

          TestUtils.renderIntoDocument(
            h(ClientProvider, { client },
              h(Connect, {}, connectRenderCb)
            )
          )
        })
      })
    })
  })
})
