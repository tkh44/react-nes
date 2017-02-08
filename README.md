# react-nes

[![npm version](https://badge.fury.io/js/react-nes.svg)](https://badge.fury.io/js/react-nes)
[![Build Status](https://travis-ci.org/tkh44/react-nes.svg?branch=master)](https://travis-ci.org/tkh44/react-nes)
[![codecov](https://codecov.io/gh/tkh44/react-nes/branch/master/graph/badge.svg)](https://codecov.io/gh/tkh44/react-nes)



React components for [nes](https://github.com/hapijs/nes)

```bash
npm install -S react-nes
```

#API

Please refer to the nes docs if you have questions about what each prop does.

[nes API documentation](https://github.com/hapijs/nes/blob/master/API.md)


## Components

### ClientProvider

##### Props

**client** (_nesClient_) : nes client instance

**onError** (_function_) : `client.onConnect`

**onConnect** (_function_) : `client.onConnect`

**onDisconnect** (_function_) `client.onDisconnect`

**onUpdate** (_function_) `client.onUpdate`

**children** (_element_) : accepts a single child


##### Example
```javascript
const client = new Nes.Client('http://localhost')
const App = ({ auth }) => {
  return (
    <ClientProvider
      client={client}
      onError={console.error}
      onConnect={() => console.log('Global connected')}
      onDisconnect={() => console.log('disconnected')}
      onUpdate={(message) => console.log('Update', message)}
    >
      <div>
        {/* ... */}
      </div>
    </ClientProvider>
  )
}
```

### Connect

##### Props

**auth** (_object|string_) : client auth

**delay** (_number_)

**maxDelay** (_number_)

**retries** (_number_)

**timeout** (_number_)

**onConnect** (_function_) :  the server response callback

**children** (_function_) :  child callback with signature `function({ connecting, connected, error, overrideReconnectionAuth, connect, disconnect })` 

##### Example
```javascript
const MyComponent = ({ auth }) => {
  return (
    <Connect
      auth={auth}
      onConnect={() => console.log('Local connected')}
    >
      {({ connecting, connected, error, overrideReconnectionAuth, connect, disconnect }) => {
        console.log(connecting, connected, error, overrideReconnectionAuth, connect, disconnect)
      }}
    </Connect>
  )
}
```

### withNesClient (HoC)

inject the client into a component's props

##### Example
```javascript
const ComponentWithClient = withNesClient(({ client }) => {
  return (
    <SomeComponentThatNeedsClient client={client}/>
  )
})
```

### Request

##### Props

**lazy** (_object|string_) : client auth

**path** (_string_)

**method** (_string_)

**headers** (_object_)

**payload** (_object_)

**onResponse** (_function_) :  the callback method using the signature `function(err, payload, statusCode, headers)`

**children** (_function_) :  child callback with signature `function({ fetching, payload, error, statusCode, headers, request })`

##### Example
```javascript
const Room = ({ id }) => {
  return (
    <Request path={`/room/${id}`}>
      {({ fetching, payload, error, statusCode }) => {
        return (
          <div>
            {statusCode !== 200 && <Redirect path={`/${statusCode}`}/>}
            {fetching && <Loader/>}
            {payload && <Content id={id} data={payload}/>}
            {error && <Error error={error}/>}
          </div>
        )
      }}
    </Request>
  )
}
```

### Subscribe

##### Props

**path** (_string_)

**handler** (_function_)

**onSubscribe** (_function_) :  the callback function called when the subscription request was received by the server or failed to transmit

**onUnsubscribe** (_function_) :  the callback function called when the unsubscribe request was received by the server or failed to transmit

**children** (_function_) :  child callback with signature `function({ subscribing, subscribed, error, getSubscriptions, subscribe, unsubscribe })`

##### Example
```javascript
const MySubscribedComponent = ({ connected, id }) => {
  if (!connected) return (<Loader/>)

  return (
    <Subscribe path={`/room/${this.props.id}`} handler={this.handleSub}>
      {({ subscribing, subscribed, error }) => {
        return (
          <div>
            {subscribing && <Loader/>}
            {subscribed && <Content id={id}/>}
            {error && <Error error={error}/>}
          </div>
        )
      }}
    </Subscribe>
  )
}
```

------------------


## Realistic Example
```javascript
// Using react-router and redux...
class RoomWrapper extends Component {
  render () {
    return (
      <Connect
        auth={auth}
        onConnect={() => console.log('Local connected')}
      >
        {({ connecting, connected, error, overrideReconnectionAuth, connect, disconnect }) => {
          return (
            <Room
              connected={connected}
              id={this.props.params.id}
              room={this.props.room}
              handleRoomSubUpdate={this.handleRoomSubUpdate}
              handleRoomResponse={this.handleRoomResponse}
            />
          )
        }}
      </Connect>
    )
  }

  handleRoomSubUpdate = (message, flags) => {
    this.props.dispatch({ type: 'room/SUB_UPDATE', payload: { message, flags } })
  }

  handleRoomResponse = (error, payload, statusCode, headers) => {
    this.props.dispatch({ type: 'room/RESPONSE', payload, error, meta: { statusCode, headers } })
  }
}

const Room = ({ connected, handleRoomSubUpdate, handleRoomResponse, id, room = {} }) => {
  if (!connected) return (<Loader/>)

  return (
    <Subscribe path={`/room/${id}`} handler={handleRoomSubUpdate}>
      {({ subscribing, subscribed, subError }) => {
        return <Request path={`/room/${id}`} onResponse={handleRoomResponse}>
          {({ fetching, statusCode, reqError }) => {
            if (subscribing || fetching) return (<Loader/>)

            if (subError || reqError) return (<Error error={subError || reqError}/>)

            if (statusCode && statusCode !== 200) return (<Redirect to={`/${statusCode}`}/>)

            return (<RoomContent id={id} room={room} subscribed={subscribed}/>)
          }}
        </Request>
      }}
    </Subscribe>
  )
}

const client = new Nes.Client('http://api.mystartup.com')
const App = ({ auth, dispatch }) => {
  return (
    <ClientProvider
      client={client}
      onError={
        (err) => dispatch({ type: 'nes/Error', payload: err })
      }
      onConnect={
        () => dispatch({ type: 'nes/Connected' })
      }
      onDisconnect={
        (willReconnect, log) => dispatch({ type: 'nes/Disconnect', payload: { willReconnect, log } })
      }
      onUpdate={
        (message) => dispatch({ type: 'nes/Message', payload: message })
      }
    >
      <RoomWrapper auth={auth}/>
    </ClientProvider>
  )
}
```
