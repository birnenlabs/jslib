Common js code used in other repos.

## Developer Documentation
### git + ssh

Add your public key to https://github.com/settings/ssh.

```shell
mkdir git
cd git
git clone https://github.com/birnenlabs/jslib


cd jslib
git remote set-url origin git+ssh://git@github.com/birnenlabs/jslib
```

### eslint
#### installs eslint runtime in the repo root directory
```shell
npm install 
```

#### Check for linting errors
```shell
npm run eslint
```

#### Fix all auto-fixable linting errors
```shell
npm run eslint-fix
```

#### Check types
```shell
npm run typecheck
```
