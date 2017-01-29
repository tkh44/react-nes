# react-nes

[![npm version](https://badge.fury.io/js/react-nes.svg)](https://badge.fury.io/js/react-nes)
[![Build Status](https://travis-ci.org/tkh44/react-nes.svg?branch=master)](https://travis-ci.org/tkh44/react-nes)
[![codecov](https://codecov.io/gh/tkh44/react-nes/branch/master/graph/badge.svg)](https://codecov.io/gh/tkh44/react-nes)



React components for [nes](https://github.com/hapijs/nes)

### *In Development*

### Request
```javascript
<Request path={`/room/${this.props.id}`}>
  {({ fetching, payload, error, statusCode }) => {
    return (
      <div>
        {statusCode !== 200 && <Redirect path={`/${statusCode}`}/>}
        {fetching && <Loader/>}
        {payload && <Content id={this.props.id} data={payload}/>}
        {error && <Error error={error}/>}
      </div>
    )
  }}
</Request>
```

### Subscribe
```javascript
<Subscribe path={`/room/${this.props.id}`} handler={this.handleSub}>
  {({ subscribing, subscribed, error }) => {
    return (
      <div>
        {subscribing && <Loader/>}
        {subscribed && <Content id={this.props.id}/>}
        {error && <Error error={error}/>}
      </div>
    )
  }}
</Subscribe>
```

### Request + Subscribe
```javascript
<Request path={`/room/${this.props.id}`} onResponse={this.handleResponse}>
  {({ fetching, error, statusCode }) => {
    return (
      <Subscribe path={`/room/${this.props.id}`} handler={this.handleSub}>
        {({ subscribing, subscribed, subError }) => {
          if (fetching || subscribing) {
            return <Loader/>
          }

          if (error || subError) {
            return <Error error={error}/>
          }

          return (subscribed && <Content id={this.props.id} data={this.state.mergedData}/>)
        }}
      </Subscribe>
    )
  }}
</Request>
```