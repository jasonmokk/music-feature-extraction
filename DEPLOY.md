# Deploying to Vercel

This guide provides step-by-step instructions for deploying your Music Analysis Pipeline application to Vercel.

## Prerequisites

1. Create a [Vercel account](https://vercel.com/signup) if you don't have one
2. Install Node.js (16.x or later) from [nodejs.org](https://nodejs.org)
3. Install the Vercel CLI: `npm install -g vercel`

## Deployment Steps

### 1. Prepare Your Repository

1. Make sure your code is committed to a Git repository (GitHub, GitLab, or Bitbucket)
2. Ensure all required files are present:
   - package.json
   - vercel.json
   - build.js
   - web/ directory with all your web files

### 2. Deploy Using Vercel CLI

#### Login to Vercel

```bash
vercel login
```

Follow the authentication prompts to link your Vercel account.

#### Deploy Your Project

Navigate to your project directory and run:

```bash
vercel
```

The CLI will guide you through the deployment process:

1. Set up and deploy? `y`
2. Which scope to deploy to? (Select your account)
3. Link to an existing project? `n` (if first deployment)
4. Project name? (Use default or customize)
5. In which directory is your code located? `./` (Root directory)
6. Want to override the settings? `n` (Use settings from vercel.json)

The CLI will then deploy your project to a preview URL.

#### Deploy to Production

Once you've verified everything works on the preview URL, deploy to production:

```bash
vercel --prod
```

### 3. Deploy Using Vercel Web Interface

#### Connect to Git Repository

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your repository from GitHub, GitLab, or Bitbucket
4. Configure project settings:
   - Framework Preset: Other
   - Root Directory: `/`
   - Build Command: `npm run build`
   - Output Directory: `public`
5. Click "Deploy"

### 4. Environment Variables (If Needed)

If your application requires environment variables, you can add them:

1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" → "Environment Variables"
3. Add any required variables
4. Redeploy your application

### 5. Custom Domain (Optional)

To set up a custom domain:

1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" → "Domains"
3. Add your domain and follow the instructions to configure DNS

## Troubleshooting

### CORS Issues

If you experience CORS-related errors, verify that the CORS headers in vercel.json are correctly set:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Cross-Origin-Embedder-Policy",
        "value": "require-corp"
      },
      {
        "key": "Cross-Origin-Opener-Policy",
        "value": "same-origin"
      }
    ]
  }
]
```

### Build Failures

If your build fails, check the build logs in the Vercel dashboard for specific errors. Common issues include:

- Missing dependencies in package.json
- Incorrect build command
- File path issues

## After Deployment

Once deployed, your application will be available at:

- `https://your-project-name.vercel.app`

Any commits pushed to your repository's main branch will automatically trigger a new deployment if you've set up Git integration. 