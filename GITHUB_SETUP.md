# GitHub Repository Setup Guide

Follow these steps to create your GitHub repository and publish the AutoWabba tool:

## 1. Create a New GitHub Repository

1. Go to https://github.com/new
2. Name your repository: `AutoWabba`
3. Add a description: "Automatic download helper for Wabbajack mod lists from Nexus Mods"
4. Set it as Public
5. Click "Create repository"

## 2. Push Your Code to GitHub

Run the following commands in your terminal:

```bash
# Initialize git if you haven't already
git init

# Add all files
git add .

# Commit the changes
git commit -m "Initial commit of AutoWabba"

# Add the remote repository
git remote add origin https://github.com/LucasHenriqueDiniz/AutoWabba.git

# Push to GitHub
git push -u origin master
```

## 3. Create a Release

1. Go to your repository on GitHub
2. Click on "Releases" in the right sidebar
3. Click "Create a new release"
4. Tag version: v1.0.0
5. Release title: "AutoWabba v1.0.0"
6. Description: Add release notes about the features
7. Click "Publish release"

The GitHub Actions workflow will automatically build and attach the executable to your release.

## 4. Updating Your Repository

For future updates:

```bash
# Make your changes

# Add and commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin master

# Tag for a new version
git tag v1.0.1
git push origin v1.0.1
```

This will trigger the GitHub Actions workflow to create a new release with the built executable.

---

Note: Make sure your GitHub account has a personal access token with the proper permissions if you encounter authentication issues.
