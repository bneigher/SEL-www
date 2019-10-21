## Static Website

Can be hosted on github pages

### Development

Make sure all dependenices are installed. To do this, with a terminal window scoped to the root directory of this project:

```
npm install
```

This requires node.js to be installed which can be down via brew (mac binary software installer) / nvm (node version manager)

To run locally:

```
npm run start
```

This should open a auto-refeshing browser session on your machine.

#### Technical Notes:

Each page can be found in the views subfolder of the src folder of this repo. The .hbs extension is "handlebars" and is simply a template rendering engine. It's purpose is to do things like loop through an array of data items (schools, studies, ect) and generate psudo-dynamic HTML. Also, it makes it so each reference to shared components (like the nav, or footer) are all included by reference to the component definition (`src/views/partials/nav.hbs`, `src/views/partials/footer.hbs`), so you only need to change one file to get all pages to reflect the change. This is only useful for development, as the build process will create clones of each partial for each reference of sed partial.

### Deployment

Once you're happy with your changes, run this command to generate a new version of the site:

```
npm run build
```

This will create or update a `docs` directory which is the raw website. You can view it locally by opening the docs/index.html page in your browser on your computer

Once the build process completes, you can add, commit and push the code (to the master branch), and github will redeploy the website on your bahalf within 30s.

```
git add .
```

```
git commit -m "Description of changes here"
```

```
git push origin master
```
