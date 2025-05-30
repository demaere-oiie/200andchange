// # Packrat parsing (PEG style)
//
// This is a parser combinator library for building [packrat parsers][].
// It was submitted as part of the artifacts for the 2017 paper [Incremental
// Packrat Parsing](https://ohmjs.org/pubs/sle2017/incremental-packrat-parsing.pdf).
//
// [Source](https://github.com/ohmjs/sle17/blob/a03cbbebeb7b7f5639ee0f72b6a3aafe9247dc9d/src/standard.js)
//
// [packrat parsers]: https://en.wikipedia.org/wiki/Packrat_parser
//
// **License:** [MIT](https://github.com/ohmjs/sle17/blob/a03cbbebeb7b7f5639ee0f72b6a3aafe9247dc9d/LICENSE)<br>
// **Copyright:** (c) 2017 Patrick Dubroy and Alessandro Warth

class Matcher {
  constructor(rules) {
    this.rules = rules;
  }

  match(input) {
    this.input = input;
    this.pos = 0;
    this.memoTable = [];
    const cst = new RuleApplication("start").eval(this);
    if (this.pos === this.input.length) {
      return cst;
    }
    return null;
  }

  memoTableAt(pos) {
    let memo = this.memoTable[pos];
    if (!memo) {
      // Lazily initialize the memo column.
      memo = this.memoTable[pos] = {};
    }
    return memo;
  }

  hasMemoizedResult(ruleName) {
    return !!this.memoTableAt(this.pos)[ruleName];
  }

  memoizeResult(pos, ruleName, cst) {
    const result = { cst, nextPos: this.pos };
    this.memoTableAt(pos)[ruleName] = result;
    return result;
  }

  useMemoizedResult(ruleName) {
    const result = this.memoTableAt(this.pos)[ruleName];
    // Unconditionally set the position. If it was a failure, `result.cst`
    // is `null` and the assignment to `this.pos` is a noop.
    this.pos = result.nextPos;
    return result.cst;
  }

  consume(c) {
    if (this.input[this.pos] === c) {
      this.pos++;
      return true;
    }
    return false;
  }
}

class RuleApplication {
  constructor(ruleName) {
    this.ruleName = ruleName;
  }

  eval(matcher) {
    const name = this.ruleName;
    if (matcher.hasMemoizedResult(name)) {
      return matcher.useMemoizedResult(name);
    } else {
      const origPos = matcher.pos;
      const cst = matcher.rules[name].eval(matcher);
      matcher.memoizeResult(origPos, name, cst);
      return cst;
    }
  }
}

class Terminal {
  constructor(str) {
    this.str = str;
  }

  eval(matcher) {
    for (let i = 0; i < this.str.length; i++) {
      if (!matcher.consume(this.str[i])) {
        return null;
      }
    }
    return this.str;
  }
}

class Choice {
  constructor(exps) {
    this.exps = exps;
  }

  eval(matcher) {
    const origPos = matcher.pos;
    for (let i = 0; i < this.exps.length; i++) {
      matcher.pos = origPos;
      const cst = this.exps[i].eval(matcher);
      if (cst !== null) {
        return cst;
      }
    }
    return null;
  }
}

class Sequence {
  constructor(exps) {
    this.exps = exps;
  }

  eval(matcher) {
    const ans = [];
    for (let i = 0; i < this.exps.length; i++) {
      const exp = this.exps[i];
      const cst = exp.eval(matcher);
      if (cst === null) {
        return null;
      }
      if (!(exp instanceof Not)) {
        ans.push(cst);
      }
    }
    return ans;
  }
}

class Not {
  constructor(exp) {
    this.exp = exp;
  }

  eval(matcher) {
    const origPos = matcher.pos;
    if (this.exp.eval(matcher) === null) {
      matcher.pos = origPos;
      return true;
    }
    return null;
  }
}

class Repetition {
  constructor(exp) {
    this.exp = exp;
  }

  eval(matcher) {
    const ans = [];
    while (true) {
      const origPos = matcher.pos;
      const cst = this.exp.eval(matcher);
      if (cst === null) {
        matcher.pos = origPos;
        break;
      } else {
        ans.push(cst);
      }
    }
    return ans;
  }
}

// A simple test.
const m = new Matcher({
  start: new RuleApplication("exp"),
  exp: new Sequence([
    new RuleApplication("var"),
    new Repetition(
      new Sequence([new RuleApplication("op"), new RuleApplication("var")]),
    ),
  ]),
  op: new Choice([new Terminal("+"), new Terminal("-")]),
  var: new Choice([new Terminal("x"), new Terminal("y"), new Terminal("z")]),
});

function assertOk(val) {
  if (val == null) {
    throw new Error("Assertion failed");
  }
}

assertOk(m.match("x"));
assertOk(m.match("x-z"));
assertOk(m.match("x+y-z"));
assertOk(!m.match("x+y-"));
