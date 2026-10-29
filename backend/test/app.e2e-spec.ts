import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CourseSummary } from './../src/courses/course-summary';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/courses (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses')
      .expect(200);
    const courses = response.body as CourseSummary[];

    expect(courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CS101',
          name: 'Nhập môn lập trình',
          capacity: 60,
          registeredCount: 0,
          availableSeats: 60,
        }),
      ]),
    );
  });

  it('/courses/:id (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses/1')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        code: 'CS101',
        name: 'Nhập môn lập trình',
        capacity: 60,
        registeredCount: 0,
        availableSeats: 60,
      }),
    );
  });

  it('/courses/:id rejects invalid and missing ids', async () => {
    await request(app.getHttpServer()).get('/courses/not-a-number').expect(400);
    await request(app.getHttpServer()).get('/courses/0').expect(400);
    await request(app.getHttpServer()).get('/courses/999999').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
