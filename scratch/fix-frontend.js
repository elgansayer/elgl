const fs = require('fs');

function fixChatRoom() {
  const file = 'frontend/src/app/components/chat-room/chat-room.component.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('computed,')) {
    content = content.replace(/import { Component, signal, inject, OnInit, ViewChild, ElementRef, HostListener, effect } from '@angular\/core';/, 
      "import { Component, signal, inject, OnInit, ViewChild, ElementRef, HostListener, effect, computed } from '@angular/core';");
  }
  fs.writeFileSync(file, content);
}

function fixDiscoveryComponent() {
  const file = 'frontend/src/app/components/discovery/discovery.component.ts';
  let content = fs.readFileSync(file, 'utf8');
  // getNativeLangs(user: UserProfile) {
  //   return [ { code: user.native_languages, level: 100 } ];
  // }
  content = content.replace(/code: user\.native_languages,/g, 'code: user.native_languages[0] || "",');
  // wait, better yet, map over native_languages!
  content = content.replace(/return \[\s*{\s*code: user\.native_languages(\[0\] \|\| "")?,\s*level: 100\s*}\s*\];/g, 
    "return (user.native_languages || []).map(lang => ({ code: lang, level: 100 }));");
  fs.writeFileSync(file, content);
}

function fixSearchFilterParams() {
  const file = 'frontend/src/app/services/discovery.service.ts';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/native_languages\?: string\[\];/g, 'native_languages?: string;');
  fs.writeFileSync(file, content);
}

function fixProfileVisitors() {
  const file = 'frontend/src/app/components/profile-visitors/profile-visitors.component.html';
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\{\{\s*visit\.visitor\.native_languages\s*\|\s*uppercase\s*\}\}/g, "{{ visit.visitor.native_languages.join(', ') | uppercase }}");
    fs.writeFileSync(file, content);
  }
  const tsFile = 'frontend/src/app/components/profile-visitors/profile-visitors.component.ts';
  if (fs.existsSync(tsFile)) {
    let content = fs.readFileSync(tsFile, 'utf8');
    content = content.replace(/\{\{\s*visit\.visitor\.native_languages\s*\|\s*uppercase\s*\}\}/g, "{{ (visit.visitor.native_languages || []).join(', ') | uppercase }}");
    fs.writeFileSync(tsFile, content);
  }
}

function fixUserDetail() {
  const file = 'frontend/src/app/components/user-detail/user-detail.component.html';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\{\{\s*profile\(\)\?\.native_languages\s*\|\s*uppercase\s*\}\}/g, "{{ profile()?.native_languages?.join(', ') | uppercase }}");
  fs.writeFileSync(file, content);
}

function fixProfileComponent() {
  const file = 'frontend/src/app/components/profile/profile.component.html';
  let content = fs.readFileSync(file, 'utf8');
  
  // replace nativeLanguages display 
  content = content.replace(/\{\{\s*profile\(\)\?\.native_languages\s*\}\}/g, "{{ profile()?.native_languages?.join(', ') }}");

  // replace nativeLanguages editing with chip UI
  const oldPicker = `<app-language-picker (languageSelected)="nativeLanguages = $event" [selectedCode]="nativeLanguages"></app-language-picker>`;
  const newPicker = `<div class="flex flex-wrap gap-2 mb-2">
                @for (code of nativeLanguages; track code) {
                  <div class="px-3 py-1.5 rounded-full text-sm font-medium border bg-primary border-primary text-white flex items-center gap-1.5">
                    <span>{{ getLanguageFlagIcon(code) }}</span>
                    <span>{{ getLanguageName(code) }}</span>
                    <button type="button" (click)="removeNativeLanguage(code)" class="text-white/70 hover:text-white" aria-label="Remove language">✕</button>
                  </div>
                }
              </div>
              <div class="w-full max-w-[300px]">
                <app-language-picker (languageSelected)="addNativeLanguage($event)"></app-language-picker>
              </div>`;
  content = content.replace(oldPicker, newPicker);
  fs.writeFileSync(file, content);

  // add methods to ts
  const tsFile = 'frontend/src/app/components/profile/profile.component.ts';
  let tsContent = fs.readFileSync(tsFile, 'utf8');
  if (!tsContent.includes('addNativeLanguage')) {
    const methods = `
  addNativeLanguage(code: string) {
    if (this.nativeLanguages.length < 3 && !this.nativeLanguages.includes(code)) {
      this.nativeLanguages = [...this.nativeLanguages, code];
    }
  }

  removeNativeLanguage(code: string) {
    this.nativeLanguages = this.nativeLanguages.filter(l => l !== code);
  }
`;
    tsContent = tsContent.replace(/addTargetLanguage/g, methods + '\n  addTargetLanguage');
    fs.writeFileSync(tsFile, tsContent);
  }
}

fixChatRoom();
fixDiscoveryComponent();
fixSearchFilterParams();
fixProfileVisitors();
fixUserDetail();
fixProfileComponent();

console.log('Frontend fixes applied');
