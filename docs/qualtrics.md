You can embed qualtrics surveys as a page element, and the final "submit" in qualtrics will submit the page.

It helps to modify the CSS for the qualtrics page in qualtrics itself, under **look and feel** > **Style** > **Custom CSS**, enter the following styling to make sure that the embedded iframe can take the full width of the page.

```css
.Skin .SkinInner {
  max-width: 90% !important;
  width: 90% !important;
  margin: 0 auto !important; /* center it horizontally */
}

.Skin .QuestionText,
.Skin .QuestionBody {
  max-width: 90% !important;
  width: 90% !important;
  margin: 0 auto !important; /* center question text */
}

#SkinContent {
  width: 90vw !important;
  max-width: 90vw !important;
  margin: 0 auto !important; /* center main content */
}
```
