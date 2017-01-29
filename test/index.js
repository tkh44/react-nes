/* eslint-env mocha */
const Hapi = require('hapi')
const Nes = require('nes')
const React = require('react')
const expect = require('expect')
const TestUtils = require('react-addons-test-utils')
const ReactNes = require('../src/index')

const { PropTypes, Component, createElement: h, Children } = React
const { ClientProvider, withNesClient, Connect, Subscribe } = ReactNes

describe('react-nes', () => {
  class Child extends Component {
    render () {
      return h('div')
    }
  }

  Child.contextTypes = { client: PropTypes.object.isRequired }

  describe('ClientProvider', () => {
    const client = {}

    it('enforces single child', (done) => {
      expect(() => TestUtils.renderIntoDocument(
        h(ClientProvider, { client }, h(Child))
      )).toNotThrow()

      try {
        expect(() => TestUtils.renderIntoDocument(
          h(ClientProvider, { client })
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
    const client = {}
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
                  setTimeout(() => {
                    client.disconnect()
                    server.stop(done)
                  })
                }
              }, renderCb)
            )
          )
        })
      })
    })
  })

  describe('Subscribe', () => {
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
            return connected && h(
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
                }
              }, connectRenderCb)
            )
          )
        })
      })
    })
  })
})
