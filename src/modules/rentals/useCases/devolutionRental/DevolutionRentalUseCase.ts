import { inject, injectable } from "tsyringe";

import { ICarsRepository } from "@modules/cars/repositories/ICarsRepository";
import { Rental } from "@modules/rentals/infra/typeorm/entities/Rental";
import { IRentalsRepository } from "@modules/rentals/repositories/IRentalsRepository";
import { IDateProvider } from "@shared/container/providers/DateProvider/IDateProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  id: string;
  user_id: string;
}

@injectable()
class DevolutionRentalUseCase {
  constructor(
    @inject("RentalsRepository") private rentalsRepository: IRentalsRepository,
    @inject("DayjsDateProvider") private dateProvider: IDateProvider,
    @inject("CarsRepository") private carsRepository: ICarsRepository
  ) {}

  async execute({ id, user_id }: IRequest): Promise<Rental> {
    const rental = await this.rentalsRepository.findById(id);
    const MINIMUM_DAILIES = 1;

    if (!rental) {
      throw new AppError("Rental does not exist");
    }

    const car = await this.carsRepository.findById(rental.car_id); // aqui ela passa a porra do id ???

    const dateNow = this.dateProvider.dateNow();

    let dailies = this.dateProvider.compareInDays(rental.start_date, dateNow);

    if (dailies <= 0) {
      dailies = MINIMUM_DAILIES;
    }

    const delay = this.dateProvider.compareInDays(
      dateNow,
      rental.expected_return_date
    );

    let total = 0;

    if (delay > 0) {
      const calculate_fine = delay * car.fine_amount;
      total = calculate_fine;
    }

    total += dailies * car.daily_rate;

    rental.end_date = this.dateProvider.dateNow();
    rental.total = total;

    await this.rentalsRepository.create(rental);

    await this.carsRepository.updateAvailable(car.id, true);

    return rental;
  }
}

export { DevolutionRentalUseCase };
