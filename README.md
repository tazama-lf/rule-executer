## rule-executer
Generic rule executer

## testing
To test a rule in the executer will be a two-step process. Firstly, pack your rule's code to a library on your machine, then install the Rule in the executor. 
1. From Rule-xxx run:
`npm run build` to make sure you've got the latest code built to publish
Followed by 
`npm pack` to create a library folder `./lib`
2. From Rule Executer run (`rule-xxx` needs to be the name as specified in the above rule's package.json):
`npm i rule@file:C:\\source\\github\\actiofrm\\rule-901\\lib`

Now you can run your rule engine and it will call the `handleTransaction` method from your desired Rule Processor. You'll be able to step into the method call while debugging.

## deployment on Jenkins
The Jenkins job will have to call a packaged library. So the `rule` in the package.json will have to be installed as follows:
1. Firstly remove the current `rule` reference:
`npm uninstall rule`
2. Then install the expected release version of the `rule-processor` lib:
`npm i rule@npm:@frmscoe/rule-901@latest`

Furthermore, from Jenkins we'll also need to modify the rule-executer-deploy.yml file, to give the processor the correct name, as well as make sure it points to your library (note the above install / uninstall SED functions also in below script):

```
// Modify below lines to give the correct name for your Rule:
sh 'sed -i \'s/off-rule-executer/off-rule-901/g\' rule-executer-deploy.yml'
sh 'sed -i \'s/RULE_NAME="901"/RULE_NAME="901"/g\' Dockerfile'

withNPM(npmrcConfig: 'guid') {
  // Modify below line to give the correct library for your Rule (eg, change rule-901 to whatever your rule package is called):
  sh 'sed -i \'s/RUN npm install/COPY .npmrc .npmrc\\nRUN npm uninstall rule\\nRUN npm i rule@npm:@frmscoe\\/rule-901@latest\\nRUN npm install/g\' Dockerfile'
}
```

## publishing your rule as a library
Make sure you have a index.ts in the root of your rule that is exporting your `handleTransaction` method:
`export { handleTransaction }`

Ensure the "name" property in your package.json starts with your organization name, eg: `"name": "@frmscoe/rule-901",`

Ensure the Package.json has the following:
`
  "publishConfig": {
    "@frmscoe:registry": "https://npm.pkg.github.com/"
  },
  `
