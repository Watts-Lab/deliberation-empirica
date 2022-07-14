/**
 * We can output log messages in bold in Cypress using "**" notation -
 * but if we search for component by "*" we break it. Thus we need to escape
 * component names
 */
 const markupEscape = (s) => s.replace(/\*/g, '\\*');

 /**
  * Convert props or state into pairs like key="value"
  */
 const serializeToLog = (props) =>
   Object.keys(props)
     .map((key) => `${key}=${JSON.stringify(props[key])}`)
     .join(' ');
 
 /**
  * Log the component identifier messages
  * @param {*} component
  * @param {*} props
  * @param {*} state
  */
 const getIdentifierLogs = (
   component,
   props,
   state
 ) => {
   let logMessage = `**<${markupEscape(component)}`;
   if (props) {
     logMessage += ' ' + serializeToLog(props);
   }
   if (state) {
     logMessage += ' ' + serializeToLog(state);
   }
 
   logMessage += '>**';
   return logMessage;
 };
 
 /**
  * get the component not found error logs
  * @param {*} component
  * @param {*} props
  * @param {*} state
  */
 const getComponentNotFoundMessage = (component, props, state) => {
   const message = `**Component not found ${getIdentifierLogs(
     component,
     props,
     state
   )}**\n\n
   
   There can be multiple reasons for it.\n
   > Component never meant to exists. You are good to go. 
   > Check the root is defined as a env parameter (cypress.json config file).\n
   > If the root is defined correctly, check other parameters - component name, props and state objects\n
   
   Or, raise an issue with proper code samples here: https://github.com/abhinaba-ghosh/cypress-react-selector/issues`;
   return message;
 };

/**
 * safely handles circular references
 */
 const safeStringify = (obj, indent = 2) => {
  let cache = [];
  let retVal = '';
  try {
    retVal = JSON.stringify(
      obj,
      (key, value) =>
        typeof value === 'object' && value !== null
          ? cache.includes(value)
            ? undefined // Duplicate reference found, discard key
            : cache.push(value) && value // Store value in our collection
          : value,
      indent
    );
  } catch (err) {
    retVal = 'State can not be Stringified';
  }
  cache = null;
  return retVal;
};

/**
 * get json value by string keys
 * @param {*} object
 * @param {*} keys
 */
const getJsonValue = (o, s) => {
  s = s.replace(/\[(\w+)\]/g, '.$1');
  s = s.replace(/^\./, '');
  var a = s.split('.');
  for (var i = 0, n = a.length; i < n; ++i) {
    var k = a[i];
    if (k in o) {
      o = o[k];
    } else {
      return;
    }
  }
  return o;
};

/**
 * get the type of the object
 * @param {*} p
 */
const getType = (p) => {
  if (Array.isArray(p)) return 'array';
  else if (typeof p == 'string') return 'string';
  else if (p != null && typeof p == 'object') return 'object';
  else return 'other';
};

/**
 * get the root element
 * @param {*} root
 */
const getReactRoot = (root) => {
  if (root) {
    return root;
  }

  if (Cypress.env('cypress-react-selector')) {
    return Cypress.env('cypress-react-selector').root;
  }

  return undefined;
};

/**
 * get runtime options
 */
const getDefaultCommandOptions = (reactOpts) => {
  return {
    timeout:
      ((reactOpts || {}).options || {}).timeout ||
      Cypress.config().defaultCommandTimeout,
  };
};

/**
 * Check if ReactOpts is valid
 * @param {Object} reactOpts
 */
const checkReactOptsIsValid = (reactOpts) => {
  const keys = Object.keys(reactOpts);
  const regexp = /^(?!props$|state|exact|options|root$).*/g;
  const atLeastOneMatches = keys.some((e) => regexp.test(e));
  if (keys.length > 3 || atLeastOneMatches) {
    return false;
  } else {
    return true;
  }
};

/**
 * Validate and get resq node for fetching props and states
 * @param {object || object[]} subject
 */
const getReactNode = (subject) => {
  if (!subject) {
    throw new Error(
      'Previous subject found null. getProps/getCurrentState is a child command. Use with cy.getReact()'
    );
  }
  if (
    Array.isArray(subject) &&
    (subject[0].props || subject[0].state) &&
    subject.length > 1
  ) {
    throw new Error(
      `getCurrentState/getProps works with single React Node. Number of React Node found ${subject.length}. Use nthNode(index) to fetch an unique react node`
    );
  }

  return Array.isArray(subject) ? subject[0] : subject;
};

/************************** EXPORTS *****************************/

/**
 * mount resq to query react
 */
exports.waitForReact = () => {
  cy.readFile('node_modules/resq/dist/index.js', 'utf8').then((script) => {
    cy.window().then({ timeout: 5000 }, (win) => {
      win.eval(script);
      win.resq = win.exports.resq
      return new Cypress.Promise.resolve(
        win.exports.resq.waitToLoadReact(5000, Cypress.env('cypress-react-selector').root)
      )
        .then(() => {
          cy.log('[cypress-react-selector] loaded');
        })
        .catch((err) => {
          throw new Error(
            `[cypress-react-selector] root found as ${reactRoot}. It is not valid root for your application.`
          );
        });
    });
  });
}

/**
 * find react element by component, props and states
 * @param {String} component
 * @param {Object} reactOpts
 * @param {Object} options
 */
 exports.react = (subject, component, reactOpts = {}) => {
  if (subject === null) {
    throw new Error(`Previous component found null.`);
  }

  if (reactOpts && !checkReactOptsIsValid(reactOpts)) {
    throw new Error(
      `ReactOpts is not valid. Valid keys are props,state,exact,root,options.`
    );
  }

  let contextNode;
  let withinSubject = cy.state('withinSubject');

  if (Cypress.dom.isElement(subject)) {
    contextNode = subject[0];
  } else if (Cypress.dom.isDocument(subject)) {
    contextNode = subject;
  } else if (withinSubject) {
    contextNode = withinSubject[0];
  } else {
    contextNode = cy.state('window').document;
  }

  cy.log(
    `Finding ${getIdentifierLogs(component, reactOpts.props, reactOpts.state)}`
  );

  // set the retry configuration
  let retryInterval = 100;
  let retries = Math.floor(
    getDefaultCommandOptions(reactOpts).timeout / retryInterval
  );
  const isPrimitive = (x) =>
    Cypress._.isNumber(x) || Cypress._.isString(x) || Cypress._.isBoolean(x);

  const _nodes = () => {
    return cy
      .window({ log: false })
      .then(
        { timeout: getDefaultCommandOptions(reactOpts).timeout + 100 },
        (window) => {
          let elements;
          if (!window.exports.resq) {
            throw new Error(
              '[cypress-react-selector] not loaded yet. did you forget to run cy.waitForReact()?'
            );
          }

          if (subject) {
            elements = window.exports.resq.resq$$(component, contextNode);
          } else {
            if (getReactRoot(reactOpts.root) !== undefined) {
              elements = window.exports.resq.resq$$(
                component,
                cy.state('window').document.querySelector(getReactRoot(reactOpts.root))
              );
            } else {
              elements = window.exports.resq.resq$$(component);
            }
          }

          if (reactOpts.props) {
            elements = elements.byProps(reactOpts.props, {
              exact: reactOpts.exact,
            });
          }
          if (reactOpts.state) {
            elements = elements.byState(reactOpts.state, {
              exact: reactOpts.exact,
            });
          }
          if (!elements.length) {
            return null;
          }

          let nodes = [];
          elements.forEach((elm) => {
            var node = elm.node,
              isFragment = elm.isFragment;
            if (!node) {
              return;
            }
            if (isFragment) {
              nodes = nodes.concat(node);
            } else {
              nodes.push(node);
            }
          });
          if (!nodes.length) {
            return null;
          }

          return nodes;
        }
      );
  };

  const resolveValue = () => {
    const retry = () => {
      if (retries < 1) {
        cy.log(
          getComponentNotFoundMessage(
            component,
            reactOpts.props,
            reactOpts.state
          )
        );
        return;
      }

      return cy
        .wait(retryInterval, {
          log: false,
        })
        .then(() => {
          retries--;
          return resolveValue();
        });
    };

    return _nodes().then((value) => {
      if (!value) {
        return retry();
      }
      if (!isPrimitive(value)) {
        value = Cypress.$(value);
      }
      return cy.verifyUpcomingAssertions(value, (reactOpts || {}).options, {
        onRetry: retry,
      });
    });
  };

  return resolveValue();
};

/**
 * get react node (not actual element) by component, props and state
 * @param {string} component
 * @param {Object} reactOpts
 *
 * @example
 * React Node Type:
 *
 * interface RESQNode {
 *   name: 'MyComponent',
 *   node: HTMLElement | null,
 *   isFragment: boolean,
 *   state: string | boolean | any[] | {},
 *   props: {},
 *   children: RESQNode[]
 * }
 */
exports.getReact = (subject, component, reactOpts = {}) => {
  if (subject === null) {
    throw new Error(`Previous component found null.`);
  }

  if (reactOpts && !checkReactOptsIsValid(reactOpts)) {
    throw new Error(
      `ReactOpts is not valid. Valid keys are props,state,exact,root,options.`
    );
  }

  let contextNode;
  let withinSubject = cy.state('withinSubject');

  if (Cypress.dom.isElement(subject)) {
    contextNode = subject[0];
  } else if (Cypress.dom.isDocument(subject)) {
    contextNode = subject;
  } else if (withinSubject) {
    contextNode = withinSubject[0];
  } else {
    contextNode = cy.state('window').document;
  }

  cy.log(
    `Finding ${getIdentifierLogs(component, reactOpts.props, reactOpts.state)}`
  );

  // set the retry configuration
  let retryInterval = 100;
  let retries = Math.floor(
    getDefaultCommandOptions(reactOpts).timeout / retryInterval
  );

  const _nodes = () => {
    return cy.window({ log: false }).then(
      {
        timeout: getDefaultCommandOptions(reactOpts).timeout + 100,
      },
      (window) => {
        let elements;
        if (!window.exports.resq) {
          throw new Error(
            `did you forget to run cy.waitForReact()?`
          );
        }

        if (subject) {
          elements = window.exports.resq.resq$$(component, contextNode);
        } else {
          if (getReactRoot(reactOpts.root) !== undefined) {
            elements = window.exports.resq.resq$$(
              component,
              cy.state('window').document.querySelector(getReactRoot(reactOpts.root))
            );
          } else {
            elements = window.exports.resq.resq$$(component);
          }
        }

        if (reactOpts.props) {
          elements = elements.byProps(reactOpts.props, {
            exact: reactOpts.exact,
          });
        }
        if (reactOpts.state) {
          elements = elements.byState(reactOpts.state, {
            exact: reactOpts.exact,
          });
        }
        elements = elements.filter(Boolean);
        if (!elements.length) {
          return null;
        }
        return elements;
      }
    );
  };

  const resolveValue = () => {
    const retry = () => {
      if (retries < 1) {
        cy.log(
          getComponentNotFoundMessage(
            component,
            reactOpts.props,
            reactOpts.state
          )
        );
        return;
      }
      return cy
        .wait(retryInterval, {
          log: false,
        })
        .then(() => {
          retries--;
          return resolveValue();
        });
    };

    return _nodes().then((value) => {
      if (!value) {
        return retry();
      }
      return cy.verifyUpcomingAssertions(value, (reactOpts || {}).options, {
        onRetry: retry,
      });
    });
  };

  return resolveValue();
}

exports.getProps = (subject, propName) => {
  const reactNode = getReactNode(subject);
  cy.log(`Finding value for prop **${propName || 'all props'}**`);
  cy.log(
    `Prop value found **${
      propName
        ? safeStringify(getJsonValue(reactNode.props, propName))
        : safeStringify(reactNode.props)
    }**`
  );
  const propValue = propName
    ? cy.wrap(getJsonValue(reactNode.props, propName))
    : cy.wrap(reactNode.props);
  return propValue;
};

exports.getCurrentState = (subject) => {
  const reactNode = getReactNode(subject);
  cy.log(`Finding current state of the React component`);
  cy.log(reactNode);
  cy.log(
    `Current state found **${
      getType(reactNode.state) === 'object'
        ? safeStringify(reactNode.state)
        : reactNode.state
    }**`
  );
  return cy.wrap(reactNode.state);
};
