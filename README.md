# Документация по API сервиса загрузки медиафайлов

## Введение

Сервис загрузки медиафайлов предоставляет API для загрузки изображений и видео с проверкой форматов и оптимизацией. Сервис использует хранилище MinIO для размещения файлов и поддерживает как одиночную, так и пакетную загрузку файлов.

## Базовая информация

- **Базовый URL**: `/media`
- **Версия API**: 1.0.0

## Поддерживаемые форматы файлов

### Изображения

- JPEG (`image/jpeg`)
- PNG (`image/png`)

### Видео

- MP4 (`video/mp4`)
- MOV (`video/quicktime`)

## Ограничения на файлы

### Изображения

- **Максимальный размер**: 30 МБ
- **Минимальное разрешение**: 320×320 пикселей
- **Максимальное разрешение**: 4096×4096 пикселей

### Видео

- **Максимальный размер**: 650 МБ
- **Минимальное разрешение**: 320×320 пикселей
- **Максимальное разрешение**: 1920×1080 пикселей
- **Максимальная продолжительность**: 60 секунд
- **Поддерживаемое соотношение сторон**: от 4:5 до 16:9

## Эндпоинты

### 1. Загрузка одиночного файла

```
POST /media/upload
```

#### Описание

Загружает один файл (изображение или видео) на сервер.

#### Параметры запроса

- `file` - медиафайл для загрузки (обязательный параметр)

#### Формат запроса

Multipart form data с полем `file`.

#### Коды ответов

- **200 OK** - Файл успешно загружен
- **400 Bad Request** - Ошибка в запросе (неверный формат, превышен размер и т.д.)
- **500 Internal Server Error** - Внутренняя ошибка сервера

#### Пример ответа (успешный)

```json
{
  "url": "http://localhost:9000/media/images/2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
  "type": "image",
  "filename": "2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
  "size": 524288,
  "width": 1080,
  "height": 720
}
```

### 2. Загрузка нескольких файлов

```
POST /media/upload-multiple
```

#### Описание

Загружает несколько файлов одновременно. Если хотя бы один файл не проходит валидацию, возвращается ошибка.

#### Параметры запроса

- `files` - массив медиафайлов для загрузки (обязательный параметр)

#### Ограничения

- Максимальное количество файлов: 10

#### Формат запроса

Multipart form data с полями `files[]`.

#### Коды ответов

- **200 OK** - Все файлы успешно загружены
- **400 Bad Request** - Ошибка в запросе
- **500 Internal Server Error** - Внутренняя ошибка сервера

#### Пример ответа (успешный)

```json
[
  {
    "url": "http://localhost:9000/media/images/2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
    "type": "image",
    "filename": "2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
    "size": 524288,
    "width": 1080,
    "height": 720
  },
  {
    "url": "http://localhost:9000/media/videos/3b58e96f-7c2a-5c2f-9d49-8c56e926c2bf.mp4",
    "type": "video",
    "filename": "3b58e96f-7c2a-5c2f-9d49-8c56e926c2bf.mp4",
    "size": 10485760,
    "width": 1280,
    "height": 720
  }
]
```

### 3. Пакетная загрузка файлов

```
POST /media/upload-batch
```

#### Описание

Загружает несколько файлов в пакетном режиме. Возвращает как успешные загрузки, так и информацию об ошибках для неуспешных.

#### Параметры запроса

- `files` - массив медиафайлов для загрузки (обязательный параметр)

#### Ограничения

- Максимальное количество файлов: 10

#### Формат запроса

Multipart form data с полями `files[]`.

#### Коды ответов

- **200 OK** - Запрос обработан (даже если некоторые файлы не прошли валидацию)
- **400 Bad Request** - Ошибка в запросе или все файлы не прошли валидацию
- **500 Internal Server Error** - Внутренняя ошибка сервера

#### Пример ответа (частично успешный)

```json
{
  "success": 2,
  "failed": 1,
  "files": [
    {
      "url": "http://localhost:9000/media/images/2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
      "type": "image",
      "filename": "2a47d85d-6e1a-4b1f-8c38-7b45e815b1ae.jpg",
      "size": 524288,
      "width": 1080,
      "height": 720
    },
    {
      "url": "http://localhost:9000/media/videos/3b58e96f-7c2a-5c2f-9d49-8c56e926c2bf.mp4",
      "type": "video",
      "filename": "3b58e96f-7c2a-5c2f-9d49-8c56e926c2bf.mp4",
      "size": 10485760,
      "width": 1280,
      "height": 720
    }
  ],
  "errors": [
    {
      "filename": "invalid_file.txt",
      "error": "Неподдерживаемый тип файла"
    }
  ]
}
```

## Обработка медиафайлов

### Изображения

- Изображения больше 1080×1080 автоматически сжимаются до этого размера
- Качество JPEG устанавливается на 85% для оптимизации размера

### Видео

- Проверяется соотношение сторон (должно быть от 4:5 до 16:9)
- Проверяется продолжительность (не более 60 секунд)

## Технические детали

Сервис использует:

- NestJS в качестве основного фреймворка
- MinIO для хранения файлов
- Sharp для обработки изображений
- FFmpeg для анализа и валидации видео

## Установка и запуск

```bash
# установка зависимостей
$ npm install

# запуск в режиме разработки
$ npm run start:dev

# запуск в production режиме
$ npm run start:prod
```

## Ошибки

При возникновении ошибок API возвращает HTTP-код 400 (Bad Request) и сообщение об ошибке в формате JSON:

```json
{
  "statusCode": 400,
  "message": "Текст ошибки",
  "error": "Bad Request"
}
```

Распространенные сообщения об ошибках:

- "Файл пуст или поврежден"
- "Неподдерживаемый тип файла"
- "Невозможно определить тип файла"
- "Размер изображения/видео превышает максимально допустимый"
- "Изображение/видео слишком маленькое"
- "Соотношение сторон видео должно быть от 4:5 до 16:9"
- "Продолжительность видео превышает максимально допустимую"
