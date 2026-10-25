# Globtrop – wersja z Google Street View

Gra w zgadywanie miejsc na świecie na prawdziwych panoramach Street View.
Tryby: Ruch, No Move, NMPZ. Solo (5 rund) i mecze drużynowe 1v1–4v4 z botami (10 poziomów wiedzy) oraz ze znajomymi.

## 1. Wpisz klucz Google Maps

Otwórz plik `config.js` w Notatniku i w miejsce `WKLEJ_TUTAJ_KLUCZ` wklej swój klucz (zaczyna się od `AIza`). Zapisz plik.

Klucz musi mieć włączone **Maps JavaScript API** i podpięte płatności w Google Cloud.

## 2. Wrzuć grę do internetu (GitHub Pages, za darmo)

1. Załóż konto na github.com (jeśli nie masz).
2. Kliknij **New repository**, nazwij je `globtrop`, zostaw **Public** i kliknij **Create repository**.
3. Kliknij **uploading an existing file** i przeciągnij wszystkie pliki z tego folderu (`index.html`, `config.js`, wszystkie `.js`). Kliknij **Commit changes**.
4. Wejdź w **Settings → Pages**. W „Source” wybierz **Deploy from a branch**, gałąź **main**, folder **/(root)** i kliknij **Save**.
5. Po 1–2 minutach gra będzie pod adresem `https://TWOJNICK.github.io/globtrop/`.
6. Wróć do Google Cloud → **Dane logowania** → Twój klucz → **Ograniczenia aplikacji: Witryny** i dodaj `https://TWOJNICK.github.io/*`. Zapisz.

Klucz w `config.js` będzie widoczny w kodzie strony. Przy kluczach do Map Google to normalne. Chroni go ograniczenie do Twojej strony z punktu 6. Ustaw też alert budżetu w płatnościach Google Cloud.

Plik `index.html` otwarty prosto z dysku nie zadziała z ograniczonym kluczem. Testuj grę pod adresem z GitHub Pages.

## 3. (Opcjonalnie) Gra ze znajomymi przez Firebase

Bez tego kroku działają solo i mecze z botami.

1. Wejdź na console.firebase.google.com i kliknij **Dodaj projekt**. Możesz wybrać ten sam projekt Google Cloud, w którym masz klucz.
2. W menu **Build → Realtime Database** kliknij **Create database**. Lokalizacja: **europe-west1**. Tryb: **locked mode**.
3. W zakładce **Rules** wklej poniższe reguły i kliknij **Publish**:

```json
{
  "rules": {
    "lobby": { ".read": true, "peers": { "$p": { ".write": true, ".validate": "newData.child('p').isString() && newData.child('p').val().length < 6000" } } },
    "rooms": { "$r": { ".read": true, "peers": { "$p": { ".write": true, ".validate": "newData.child('p').isString() && newData.child('p').val().length < 6000" } } } }
  }
}
```

4. Wejdź w **Ustawienia projektu** (zębatka) → **Twoje aplikacje** → ikona **`</>`** (Web). Nazwij aplikację i kliknij **Zarejestruj**.
5. Skopiuj obiekt `firebaseConfig` (sam fragment w nawiasach klamrowych) i wklej go w `config.js` zamiast `null` przy `firebase:`. Musi zawierać `databaseURL`. Przykład:

```js
firebase: {
  apiKey: "...",
  authDomain: "....firebaseapp.com",
  databaseURL: "https://...europe-west1.firebasedatabase.app",
  projectId: "...",
  appId: "..."
}
```

6. Wyślij nowy `config.js` na GitHuba (Add file → Upload files).

Teraz w menu gry: **Mecz drużynowy → Pokój dla znajomych**. Podaj znajomym kod pokoju albo niech klikną Twój pokój na liście otwartych gier.

## Sterowanie

- Przeciągnij myszą, żeby się rozejrzeć. Kółko myszy przybliża.
- W trybie Ruch klikaj strzałki na drodze albo przyciski na dole. Flaga po lewej wraca na start.
- Kliknij na mapie, żeby postawić pinezkę. Spacja albo przycisk „Zgadnij” zatwierdza.
