# ren-react

[![Build status](https://badge.buildkite.com/90ff98db996bb137c5be1bdce666c4b1ce68a25b17af0a6a04.svg?branch=master)](https://buildkite.com/harvey/react-component-library)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## **`Key Features`**

**_iflex-react-library_** is created in 2021 using the most recent packaging (rollup) and tool chain technologies (Snowpack) and versions 17.x of of React.

### **Component Library Rollup**

Using **rollup** under the hood, _iflex-react-library_ provides component publishing in three different formats (Common JS, ESM and UMD) in a minified and obfuscated production build. After running **yarn publish** your library can be imported into another react application using **import {yourComponentName} from 'yourLibraryName'** or without curly braces for default exports.

### **Local Testing and Demonstration Environment**

The _iflex-react-library_ template provides local library testing and demonstration pages to be developed using the lightweight and performant Snowpack tool chain. This provides a minimal configuration, low overhead development environment with hot loading and alias mapping, allowing you to import your library in the same manner as an external application. This demonstration / testing environment may be easily published to github pages to showcase your library. Because you are not using npm link any changes made in your library are hot loaded into your application state including preseving of react state between changes.

### **Rapid Testing and Component Documentation using Storybook**

Storybook is preconfigured to work with your component library. Simply add your stories into the stories folder and your comonents will be automatically displayed in the storybook together with documentation that has been automatically assembled from comments in your component and your React PropTypes. Simply run **yarn storybook** to view your library components and interact with different property behaviours using the automatically created controls.

### **Es-Lint and TypeScript**

Common es-lint addons are included for syntax and error highlighting as you develop. You can modify the **.eslinttc** file to configure options are add additional es-lint modules via **yarn add**. If you wish to add typescript then install typescript library and appropriate es-lint libraries and rename index.js entry points for your library and test environment to index.ts

## **`Directory Structure & Configuration`**

The _iflex-react-library_ template uses the following folders.

| Directory          | Contents                                                                                                                                                                                                                                                                                                                            |
| ------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| public             | Public Assets and html (includes index.html)                                                                                                                                                                                                                                                                                        |
| dist               | Distribution files for the component library that are also published to npmjs.com. These files are automatically generated when you run yarn build or yarn publish                                                                                                                                                                  |
| build              | These are the build files used for your local testing (using Snowpack) and storybook environment. They are not published.                                                                                                                                                                                                           |
| src                | Common folder for library components, test files and Storybook stories                                                                                                                                                                                                                                                              |
| src/library        | Place your Library components here. You can organise folders within library in any manner that you like. This folder requires an index.js that will import and export your named Components as well as any default Component                                                                                                        |
| src/demo           | Place your Test Components and Pages here. You will structure this App in the same manner as you would for a React App using **create-react-app (CRA)** with the exception that **react-scripts** and other libraries installed CRA including **react-scripts** are not used. You will have manual control to add required packages |
| src/stories        | Place your Stories Here. A Story file is in format **ComponentName.stories.js**. Refer to the sample stories and Storybook documentation for more information.                                                                                                                                                                      |
| snowpack.config.js | Snowpack Configuration file. You should change the alias from _iflex-react-library_ to _your-component-name_.                                                                                                                                                                                                                       |
| rollup.config.js   | Rollup Configuration file. Settings in this file apply to the Library build only                                                                                                                                                                                                                                                    |

## **`Key Technologies`**

- [Rollup](https://github.com/rollup/rollup)
- [Snowpack v3](https://www.snowpack.dev/posts/2021-01-13-snowpack-3-0) for local demonstration and test app.
- [Storybook](https://storybook.js.org/) for easy testing and documentation of components
- [Sass](https://sass-lang.com/) SCSS and SASS
- [Babel]() Babel is used during build process. The major use for exposing babel is to adopt react presets so that JSX can be indluded in files with .js extension.

## **`Getting Started`**

**iflex-react-library** (using rollup) will create distribution files (_in dist directory_) for Common JS (index.js), ESM Modules (index.modern.js) and UMD (index.umd.js)

### **Installation**

Create your development folder (For example _my-test-react-library_) for your library and extract the github report from https://github.com/Intelliflex/iflex-react-library into your development folder. This can be done from the command line by changing into your new development directory and issung the following command.

```
git clone https://github.com/Intelliflex/iflex-react-library .
yarn install
```

### Preliminary Test

You can now veryify library is working by testing with the following commands

```
yarn storybook (This will run the storybook from /src/stories folder - you will replace these stories with your own)
yarn start     (This will run the local demonstration and testing app from /src/demo folder)
```

## **`Tailoring for Your Library`**

Follow these steps to tailor for your library

- In package.json, Change the name field to the published name of your library (Make sure this name is available on https://www.npmjs.com/) - For example _my-test-react-library_
- In package.json, Change the version to 1.0.0
- In package.json, Change the description field to match the description for your library
- In package.json, Change keywords, to suit your own library
- Change the library name in path alias section of snowpack.config.js from iflex-react-library to the name of your library.
  You can make changes to the Sample components in src/library or when you are ready replace with your own. These changes are hot loaded with the demonstration app (/src/demo) and Storybook (/src/storybook) so that when you make changes they are instantly displayed on your browser.

That's it you are now ready to publish (ensure that you have an account on https://www.npmjs.com/ and that you are logged in via npm login - if you don't know how to do this refer to documentation on https://www.npmjs.com/).

## **`Pushing Your Library to Github Pages`**

iflex-react-library provides the following scripts (inside package.json) than can be run using **yarn {script name}**

| Script Name              | Purpose                                                                                                                         |
| ------------------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| deploy-ghpages           | Pushes both storybook and demonstration app to git-hub pages. The storybook is accessable via url {your gh-pages-url}/storybook |
| deploy-ghpages-demo      | Pushes only the demonstration app to Github Pages                                                                               |
| deploy-ghpages-storybook | Pushes only the Storybook to Github Pages                                                                                       |

<br/>
Note: Github pages uses a sub folder for each library under you user name url root. This means that references to /build/library will not work as the real reference should be /{your library name}/build/library. To counteract this the script **iflex-react-ghpages.js** is run as part of the gh-pages deployment. This will change absolute references from _/build/library_ to relative reference _build/library_

## **`Deploying your demonstration App to other Hosting providers`**

```
yarn deploy
```

You may then transfer the build folder to your chosen web server. If you want to automate this then add the script associated with you target provider to the "deploy" script in package.json. Most hosting services will deploy relative to the root folder and not a sub folder (library name) like Github pages. You should change snowpack.config.js and remove the baseUrl (or make it '/')

## **`Publishing your library`**

```
yarn publish (this will automatically run yarn build)
```

If your npm login details are accepted, you should now be able to see your project on https://www.npmjs.com/

## **`Consuming your library from other Apps`**

Assuming that the Sample Comonents are still intact you can now consume your library in another React App. These steps will guide you through consuming library in a new App called my-test-iflex-create-library. It is assumed here that your have created and published a library called my-test-library using the steps above. If not substitute this with your own name. Create a folder for your test application (eg: my-test-consume-library) and ensure your terminal openend to this folder.

```
npx create-react-app .
yarn add my-test-library
```

Change you App.js (from /src folder) to

```
import React from 'react'
import { About } from 'my-test-react-library'

const App = (props) => {
  return <About />
}

export default App
```

Now run your Test App

```
yarn start
```

You should see the About Component from the library that you published.

Congratulations!
Go forth and produce! (React component libraries that is :)

## **`Side Note (React version and Library Upgrades)`**

At this time (Jan 2021) all packages can be updated via **yarn upgrade --force** to most current versions. The only exception to this presently is babel-loader which requires version 8.1.0 owing to some breaking changes that will hopefully be rectified in future versions. If your App requires React version 16.x then you can simply remove version 17 using **yarn remove react react-dom** and reinstalling them using **yarn add -D react@16.14.0 react-dom@16.14.0**. Be sure to also add these to peerDependencies object in package.json.
