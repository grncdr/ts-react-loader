# ts-react-loader

**Warning** this code is proof-of-concept quality at best! If you find the idea
compelling and would like to contribute to making it something reliably
shippable, [say hi](https://github.com/grncdr/ts-react-loader/issues/1).

## What it does

Given a file like this:

```
import * as React from 'react'

interface Props {
    foo: string
}
class FooComponent extends React.Component<Props> {
    context: {
        store: {
            dispatch: (action: any) => any
        }
    }

    render() {
        return <strong>Your foo is: {this.props.foo}</strong>
    }
}
```

This loader will emit new TypeScript with prop & context types added:

```
import * as React from 'react'
import * as PropTypes from 'prop-types'

interface Props {
    foo: string
}

class FooComponent extends React.Component<Props> {
    static propTypes = {
        foo: PropTypes.string.isRequired
    }

    static contextTypes = {
        store: PropTypes.shape({
            dispatch: PropTypes.func.isRequired
        }).isRequired
    }

    context: {
        store: {
            dispatch: Function
        }
    }

    render() {
        return <strong>Your foo is: {this.props.foo}</strong>
    }
}
```

Look ma! no repetition!
