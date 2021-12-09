require('regenerator-runtime/runtime');
const PlaywrightEnvironment = require('jest-playwright-preset/lib/PlaywrightEnvironment').default;

class CustomEnvironment extends PlaywrightEnvironment {
  async setup() {
    await super.setup();
    const page = this.global.page;
    const start = new Date();
    const port = process.env.STORYBOOK_PORT || '6006';
    const targetURL = process.env.TARGET_URL || `http://localhost:${port}`
    await page.goto(`${targetURL}/iframe.html`, { waitUntil: 'load' }).catch((err) => {
      if(err.message?.includes('ERR_CONNECTION_REFUSED')) {
        const errorMessage = `Could not access the Storybook instance at ${targetURL}. Are you sure it's running?\n\n${err.message}`;
        throw new Error(errorMessage)
      }

      throw err;
    }); // FIXME: configure
    console.log(`page loaded in ${new Date() - start}ms.`);

    await page.addScriptTag({
      content: `
        class StorybookTestRunnerError extends Error {
          constructor(storyId, error) {
            super(error.message);
            this.name = 'StorybookTestRunnerError';

            this.message = \`\nAn error occurred in the following story:\n\${storyId}\n\nMessage:\n \${error.message}\`;
          }
        }

        async function __test(storyId) {
          const channel = window.__STORYBOOK_ADDONS_CHANNEL__;
          const storyUrl = \`${targetURL}?path=/story/\${storyId}\`;
          if(!channel) {
            throw new StorybookTestRunnerError(
              storyUrl,
              { message: 'The test runner could not access the story. Are you sure the Storybook is running correctly in that URL?' }
            );
          }

          return new Promise((resolve, reject) => {
            channel.on('storyRendered', () => resolve(document.getElementById('root')));
            channel.on('storyUnchanged', () => resolve(document.getElementById('root')));
            channel.on('storyErrored', ({ description }) => reject(
              new StorybookTestRunnerError(storyUrl, { name: description }))
            );
            channel.on('storyThrewException', (error) => reject(
              new StorybookTestRunnerError(storyUrl, error))
            );
            channel.on('storyMissing', () => reject(
              new StorybookTestRunnerError(storyUrl, { message: 'The story was missing when trying to access it.' }))
            );

            channel.emit('setCurrentStory', { storyId });
          });
        };
      `,
    });
  }

  async teardown() {
    await super.teardown();
  }

  async handleTestEvent(event) {
    await super.handleTestEvent(event);
  }
}

module.exports = CustomEnvironment;
