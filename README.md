## rule-executer
Generic rule executer

## testing
To test a rule in the executer will be a two-step process. Firstly, pack your rule's code to a library on your machine, then install the Rule in the executor. 
1. From Rule-xxx run:
`npm run build` # to make sure you've got the latest code built to publish
Followed by 
`npm pack` # to create a library folder `./lib`
2. From Rule Executer run (`rule-xxx` needs to be the name as specified in the above rule's package.json):
`npm i rule@file:C:\\source\\github\\actiofrm\\rule-901\\lib`
Now you can run your rule engine and it will call the `handleTransaction` method from your desired Rule Processor. You'll be able to step into the method call while debugging.

## deployment on Jenkins
The Jenkins job will have to call a packaged library. So the `rule` in the package.json will have to be installed as follows:
1. Firstly remove the current `rule` reference:
`npm uninstall rule`
2. Then install the expected `rule-processor`:
`npm i rule@frmscoe/rule-901@latest`
3. Then install the expected release version `rule-processor`:
`npm i rule@frmscoe/rule-901@1.0.0`

## jenkins
To publish the rule-executer as a single rule processor in an environment, we'll need to first uninstall the current rule, and then just install the required rule processor:
1. `npm uninstall rule`
2. `npm i rule@frmscoe/rule-901@latest/`